import {flow, makeAutoObservable} from "mobx";
import Utils from "@eluvio/elv-client-js/src/Utils";
import UrlJoin from "url-join";
import {rootStore, transferStore} from "./index";

class TransferStore {
  listings = {};
  listingNames = {};

  filters = {
    sort_by: "created",
    sort_desc: false,
    filters: [],
    collectionIndex: -1,
    limit: 50,
    start: 0
  }

  get client() {
    return this.rootStore.client;
  }

  constructor(rootStore) {
    this.rootStore = rootStore;

    makeAutoObservable(this);
  }

  /* Listings */

  // Format returned listing format to match account profile format
  FormatListing(entry) {
    const metadata = entry.nft || {};
    const info = entry.info || {};

    const details = {
      TenantId: entry.tenant,
      ContractAddr: info.contract_addr,
      ContractId: `ictr${Utils.AddressToHash(info.contract_addr)}`,
      ContractName: info.contract_name,
      Cap: info.cap,
      TokenIdStr: info.token_id_str,
      TokenUri: info.token_uri,
      TokenOrdinal: info.ordinal,
      TokenHold: info.hold,
      TokenHoldDate: info.hold ? new Date(parseInt(info.hold) * 1000) : undefined,
      TokenOwner: Utils.FormatAddress(info.token_owner),
      VersionHash: (info.token_uri || "").split("/").find(s => s.startsWith("hq__")),

      // Listing specific fields
      ListingId: entry.id,
      CreatedAt: entry.created * 1000,
      UpdatedAt: entry.updated * 1000,
      CheckoutLockedUntil: entry.checkout ? entry.checkout * 1000 : undefined,
      SellerAddress: Utils.FormatAddress(entry.seller),
      Price: entry.price,
      Fee: entry.fee
    };

    this.listingNames[entry.id] = this.listingNames[entry.id] || metadata.display_name || "";

    return {
      metadata,
      details
    };
  }

  // Determine the right object key for saved listings
  ListingKey({listingId, tenantId, userId, userAddress, contractId, contractAddress, tokenId}={}) {
    if(userId) { userAddress = Utils.HashToAddress(userId); }

    if(contractId) { contractAddress = Utils.HashToAddress(contractId); }
    contractAddress = Utils.FormatAddress(contractAddress);

    let key = "all";
    if(userAddress) {
      key = `user-${userAddress}`;
    } else if(tenantId) {
      key = `tenant-${tenantId}`;
    } else if(contractAddress) {
      if(tokenId) {
        key = `contract-${contractAddress}-${tokenId}`;
      } else {
        key = `contract-${contractAddress}`;
      }
    } else if(listingId) {
      key = `listing-${listingId}`;
    }

    return key;
  }

  FetchTransferListings = flow(function * ({
    listingId,
    tenantId,
    userId,
    userAddress,
    contractId,
    contractAddress,
    tokenId,
    forceUpdate
  }={}) {
    if(userId) { userAddress = Utils.HashToAddress(userId); }

    if(contractId) { contractAddress = Utils.HashToAddress(contractId); }
    contractAddress = Utils.FormatAddress(contractAddress);

    const listingKey = this.ListingKey({listingId, tenantId, userId, userAddress, contractId, contractAddress, tokenId});

    try {
      let path = "/mkt/ls";
      if(userAddress) {
        path = UrlJoin("mkt", "ls", "s", userAddress);
      } else if(tenantId) {
        path = UrlJoin("mkt", "ls", "tnt", tenantId);
      } else if(contractAddress) {
        if(tokenId) {
          path = UrlJoin("mkt", "ls", "c", contractAddress, "t", tokenId);
        } else {
          path = UrlJoin("mkt", "ls", "c", contractAddress);
        }
      } else if(listingId) {
        path = UrlJoin("mkt", "l", listingId);
      }

      // TODO: Also check for search/filter params
      if(forceUpdate || (!this.listings[listingKey] || Date.now() - this.listings[listingKey].retrievedAt > 10000)) {
        const listings = yield Utils.ResponseToJson(
          yield this.client.authClient.MakeAuthServiceRequest({
            path: UrlJoin("as", path),
            method: "GET",
            headers: {
              Authorization: `Bearer ${this.client.signer.authToken}`
            }
          })
        ) || [];

        this.listings[listingKey] = {
          retrievedAt: Date.now(),
          listings: (Array.isArray(listings) ? listings : [listings])
            .map(listing => this.FormatListing(listing))
        };
      }

      return this.listings[listingKey].listings;
    } catch(error) {
      if(error.status && error.status.toString() === "404") {
        this.listings[listingKey] = [];

        return [];
      }

      this.rootStore.Log(error, true);

      throw error;
    }
  });

  async CurrentNFTStatus({listingId, nft, contractAddress, contractId, tokenId}) {
    if(contractId) { contractAddress = Utils.HashToAddress(contractId); }
    contractAddress = Utils.FormatAddress(contractAddress);

    try {
      // Check first to see if NFT has sold if listing ID is known
      if(listingId) {
        try {
          const listingStatus = await this.ListingStatus({listingId});

          if(listingStatus) {
            if(listingStatus.action === "SOLD") {
              return { sale: listingStatus };
            } else if(listingStatus.action === "UNLISTED") {
              if(nft) {
                return { listing: undefined };
              } else {
                return { error: "This listing has been removed" };
              }
            }
          }
        // eslint-disable-next-line no-empty
        } catch(error) {}
      }

      // Find existing listing based on listing ID or NFT details
      let listings = [];
      if(listingId) {
        try {
          listings = await this.FetchTransferListings({listingId, forceUpdate: true});
        // eslint-disable-next-line no-empty
        } catch(error) {}
      } else if(nft) {
        try {
          listings = (await this.FetchTransferListings({
            contractAddress: nft.details.ContractAddr,
            tokenId: nft.details.TokenIdStr,
            forceUpdate: true
          })) || [];
          // eslint-disable-next-line no-empty
        } catch(error) {}
      }

      if(listingId || listings.length > 0) {
        // Listing is not expected or listing is found
        return { listing: listings[0] };
      }

      // Listing is expected, but NFT inaccessible and not listed - check if it was sold by us
      const history = await this.UserTransferHistory();
      const lastTransfer = history
        .sort((a, b) => a.created > b.created ? -1 : 1)
        .find(entry =>
          entry.token === tokenId &&
          entry.action === "SOLD" &&
          Utils.EqualAddress(contractAddress, entry.contract) &&
          (
            Utils.EqualAddress(rootStore.userAddress, entry.seller) ||
            Utils.EqualAddress(rootStore.userAddress, entry.buyer)
          )
        );

      if(lastTransfer && Utils.EqualAddress(rootStore.userAddress, lastTransfer.seller)) {
        return { sale: lastTransfer };
      }

      return { listing: undefined };
    } catch(error) {
      rootStore.Log(error);

      return { error: typeof error === "string" ? error : "Unable to load NFT" };
    }
  }

  NFTListingStats = flow(function * ({contractAddress}) {
    const minListingResults = yield transferStore.FilteredTransferListings({
      contractAddress,
      limit: 1,
      sortBy: "price",
      sortDesc: false
    });

    if(minListingResults.listings.length === 0) {
      return { min: 0, max: 0, total: 0 };
    }

    const maxListingResults = yield transferStore.FilteredTransferListings({
      contractAddress,
      limit: 1,
      sortBy: "price",
      sortDesc: true
    });

    return {
      min: minListingResults.listings[0].details.Price,
      max: maxListingResults.listings[0].details.Price,
      total: minListingResults.paging.total
    };
  });

  FilteredTransferListings = flow(function * ({
    sortBy="created",
    sortDesc=false,
    filter,
    contractAddress,
    marketplace,
    collectionIndex=-1,
    start=0,
    limit=50
  }={}) {
    collectionIndex = parseInt(collectionIndex);

    try {
      let params = {
        sort_by: sortBy,
        sort_descending: sortDesc,
        start,
        limit
      };

      let filters = [];
      if(marketplace && collectionIndex >= 0) {
        const collection = marketplace.collections[collectionIndex];

        collection.items.forEach(sku => {
          if(!sku) { return; }

          const item = marketplace.items.find(item => item.sku === sku);

          if(!item) { return; }

          const address = Utils.SafeTraverse(item, "nft_template", "nft", "address");

          if(address) {
            filters.push(
              `contract:eq:${Utils.FormatAddress(address)}`
            );
          }
        });

        // No valid items, so there must not be anything relevant in the collection
        if(filters.length === 0) {
          return {
            paging: {
              start: params.start,
              limit: params.limit,
              total: 0,
              more: false
            },
            listings: []
          };
        }
      }

      if(contractAddress) {
        filters.push(`contract:eq:${Utils.FormatAddress(contractAddress)}`);
      } else if(filter) {
        filters.push(`nft/display_name:eq:${filter}`);
      }

      if(filters.length > 0) {
        params.filter = filters;
      }

      const { contents, paging } = yield Utils.ResponseToJson(
        yield this.client.authClient.MakeAuthServiceRequest({
          path: UrlJoin("as", "mkt", "f"),
          method: "GET",
          queryParams: params,
          headers: {
            Authorization: `Bearer ${this.client.signer.authToken}`
          }
        })
      ) || [];

      return {
        paging: {
          start: params.start,
          limit: params.limit,
          total: paging.total,
          more: paging.total > start + limit
        },
        listings: (contents || []).map(listing => this.FormatListing(listing))
      };
    } catch(error) {
      if(error.status && error.status.toString() === "404") {
        return {
          paging: {
            start: params.start,
            limit: params.limit,
            total: 0,
            more: false
          },
          listings: []
        };
      }

      throw error;
    }
  });

  CreateListing = flow(function * ({contractAddress, contractId, tokenId, price, listingId}) {
    if(contractId) { contractAddress = Utils.HashToAddress(contractId); }
    contractAddress = Utils.FormatAddress(contractAddress);

    if(listingId) {
      // Update
      return yield Utils.ResponseToFormat(
        "text",
        yield this.client.authClient.MakeAuthServiceRequest({
          path: UrlJoin("as", "wlt", "mkt"),
          method: "PUT",
          body: {
            id: listingId,
            price: parseFloat(price)
          },
          headers: {
            Authorization: `Bearer ${this.client.signer.authToken}`
          }
        })
      );
    } else {
      // Create
      return yield Utils.ResponseToJson(
        yield this.client.authClient.MakeAuthServiceRequest({
          path: UrlJoin("as", "wlt", "mkt"),
          method: "POST",
          body: {
            contract: contractAddress,
            token: tokenId,
            price: parseFloat(price)
          },
          headers: {
            Authorization: `Bearer ${this.client.signer.authToken}`
          }
        })
      );
    }
  });

  RemoveListing = flow(function * ({listingId}) {
    yield this.client.authClient.MakeAuthServiceRequest({
      path: UrlJoin("as", "wlt", "mkt", listingId),
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${this.client.signer.authToken}`
      }
    });
  });

  ListingStatus = flow(function * ({listingId}) {
    try {
      return yield Utils.ResponseToJson(
        yield this.client.authClient.MakeAuthServiceRequest({
          path: UrlJoin("as", "mkt", "status", listingId),
          method: "GET",
          headers: {
            Authorization: `Bearer ${this.client.signer.authToken}`
          }
        })
      );
    } catch(error) {
      if(error.status === 404) { return; }

      throw error;
    }
  });

  ListingNames = flow(function * () {
    return yield Utils.ResponseToJson(
      yield this.client.authClient.MakeAuthServiceRequest({
        path: UrlJoin("as", "mkt", "names"),
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.client.signer.authToken}`
        }
      })
    );
  });

  // Transfer History

  TransferKey({contractAddress, contractId, tokenId}) {
    if(contractId) { contractAddress = Utils.HashToAddress(contractId); }
    contractAddress = Utils.FormatAddress(contractAddress);

    return tokenId ? `${contractAddress}-${tokenId}` : contractAddress;
  }

  UserTransferHistory = flow(function * () {
    return yield Utils.ResponseToJson(
      yield this.client.authClient.MakeAuthServiceRequest({
        path: UrlJoin("as", "wlt", "mkt", "hst"),
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.client.signer.authToken}`
        }
      })
    );
  });

  TransferHistory = flow(function * ({contractAddress, contractId, tokenId}) {
    if(contractId) { contractAddress = Utils.HashToAddress(contractId); }
    contractAddress = Utils.FormatAddress(contractAddress);

    return yield Utils.ResponseToJson(
      yield this.client.authClient.MakeAuthServiceRequest({
        path: UrlJoin("as", "mkt", "hst", contractAddress),
        method: "GET",
        queryParams: tokenId ? { tid: tokenId } : {},
        headers: {
          Authorization: `Bearer ${this.client.signer.authToken}`
        }
      })
    );
  });
}

export default TransferStore;