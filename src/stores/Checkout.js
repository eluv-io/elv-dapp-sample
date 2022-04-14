import UrlJoin from "url-join";
import {parse as UUIDParse, v4 as UUID} from "uuid";
import {makeAutoObservable, flow, runInAction} from "mobx";
import Utils from "@eluvio/elv-client-js/src/Utils";

const PUBLIC_KEYS = {
  stripe: {
    test: "pk_test_51HpRJ7E0yLQ1pYr6m8Di1EfiigEZUSIt3ruOmtXukoEe0goAs7ZMfNoYQO3ormdETjY6FqlkziErPYWVWGnKL5e800UYf7aGp6",
    production: "pk_live_51HpRJ7E0yLQ1pYr6v0HIvWK21VRXiP7sLrEqGJB35wg6Z0kJDorQxl45kc4QBCwkfEAP3A6JJhAg9lHDTOY3hdRx00kYwfA3Ff"
  }
};

class CheckoutStore {
  currency = "USD";

  submittingOrder = false;

  stock = {};

  pendingPurchases = {};
  completedPurchases = {};

  solanaSignatures = {};

  get client() {
    return this.rootStore.client;
  }

  constructor(rootStore) {
    this.rootStore = rootStore;
    makeAutoObservable(this);

    runInAction(() => {
      this.solanaSignatures = rootStore.GetSessionStorageJSON("solana-signatures") || {};
      this.pendingPurchases = rootStore.GetLocalStorageJSON("pending-purchases") || {};
      this.completedPurchases = rootStore.GetLocalStorageJSON("completed-purchases") || {};
    });
  }

  ConfirmationId(uuid) {
    if(uuid) {
      return UUID();
    } else {
      return Utils.B58(UUIDParse(UUID()));
    }
  }

  MarketplaceStock = flow(function * ({tenantId}) {
    try {
      let stock;
      if(this.rootStore.loggedIn) {
        stock = yield Utils.ResponseToJson(
          this.client.authClient.MakeAuthServiceRequest({
            path: UrlJoin("as", "wlt", "nft", "info", tenantId),
            method: "GET",
            headers: {
              Authorization: `Bearer ${this.client.signer.authToken}`
            }
          })
        );
      } else {
        stock = yield Utils.ResponseToJson(
          this.client.authClient.MakeAuthServiceRequest({
            path: UrlJoin("as", "nft", "stock", tenantId),
            method: "GET"
          })
        );
      }

      let updatedStock = {
        ...this.stock
      };

      Object.keys((stock || {})).map(sku =>
        updatedStock[sku] = stock[sku]
      );

      this.stock = updatedStock;

      return this.stock;
    } catch(error) {
      this.rootStore.Log("Failed to retrieve marketplace stock", true);
      this.rootStore.Log(error, true);
    }
  });

  PurchaseInitiated({tenantId, confirmationId, marketplaceId, sku}) {
    this.pendingPurchases[confirmationId] = {
      confirmationId,
      tenantId,
      marketplaceId,
      sku
    };

    this.rootStore.SetLocalStorage("pending-purchases", JSON.stringify(this.pendingPurchases));
  }

  PurchaseComplete({confirmationId, success, message}) {
    this.submittingOrder = false;

    if(success) {
      this.completedPurchases[confirmationId] = {
        ...(this.pendingPurchases[confirmationId] || {})
      };

      delete this.pendingPurchases[confirmationId];
    } else {
      this.pendingPurchases[confirmationId] = {
        ...(this.pendingPurchases[confirmationId] || {}),
        failed: true,
        message
      };
    }

    this.rootStore.SetLocalStorage("pending-purchases", JSON.stringify(this.pendingPurchases));
    this.rootStore.SetLocalStorage("completed-purchases", JSON.stringify(this.completedPurchases));
  }

  ClaimSubmit = flow(function * ({marketplaceId, sku}) {
    try {
      this.submittingOrder = true;

      const tenantId = this.rootStore.marketplaces[marketplaceId].tenant_id;

      this.PurchaseInitiated({confirmationId: sku, tenantId, marketplaceId, sku});

      yield this.client.authClient.MakeAuthServiceRequest({
        method: "POST",
        path: UrlJoin("as", "wlt", "act", tenantId),
        body: {
          op: "nft-claim",
          sid: marketplaceId,
          sku
        },
        headers: {
          Authorization: `Bearer ${this.client.signer.authToken}`
        }
      });

      this.PurchaseComplete({confirmationId: sku, success: true});

      return { confirmationId: sku };
    } catch(error) {
      this.rootStore.Log(error, true);

      this.PurchaseComplete({confirmationId: sku, success: false, message: "Claim Failed"});

      throw error;
    } finally {
      this.submittingOrder = false;
    }
  });

  ListingCheckoutSubmit = flow(function * ({
    provider="stripe",
    marketplaceId,
    listingId,
    confirmationId,
    email
  }) {
    if(this.submittingOrder) { return; }

    const requiresPopup = this.rootStore.embedded && !["wallet-balance", "linked-wallet"].includes(provider);
    confirmationId = confirmationId || (provider === "linked-wallet" ? this.ConfirmationId(true) : `T-${this.ConfirmationId()}`);

    let popup;
    try {
      if(requiresPopup) {
        popup = window.open("about:blank");
      }

      this.submittingOrder = true;


      let authInfo = this.rootStore.AuthInfo() || {};
      if(!authInfo?.user) {
        authInfo.user = {};
      }

      email = email || (authInfo.user || {}).email || this.rootStore.userProfile.email;
      authInfo.user.email = email;

      if(!email) {
        throw {
          recoverable: false,
          message: "Unable to determine email address in checkout submit"
        };
      }

      const listing = (yield this.rootStore.transferStore.FetchTransferListings({listingId, forceUpdate: true}))[0];
      if(!listing || (listing && listing.details.CheckoutLockedUntil && listing.details.CheckoutLockedUntil > Date.now())) {
        throw {
          status: 409,
          recoverable: false,
          uiMessage: "Listing is no longer available"
        };
      }

      const basePath =
        marketplaceId ?
          UrlJoin("/marketplace", marketplaceId, "store", listing.details.TenantId, listingId, "purchase", confirmationId) :
          UrlJoin("/wallet", "listings", listing.details.TenantId, listingId, "purchase", confirmationId);

      this.PurchaseInitiated({confirmationId, tenantId: listing.details.TenantId, listingId});

      if(requiresPopup) {
        // Stripe doesn't work in iframe, open new window to initiate purchase
        const url = new URL(window.location.origin);
        url.pathname = window.location.pathname;
        url.hash = basePath;
        url.searchParams.set("embed", "");
        url.searchParams.set("provider", provider);
        url.searchParams.set("marketplaceId", marketplaceId || "");
        url.searchParams.set("listingId", listingId);

        if(!this.rootStore.darkMode) {
          url.searchParams.set("lt", "");
        }

        url.searchParams.set("auth", Utils.B64(JSON.stringify(authInfo)));

        popup.location.href = url.toString();

        this.MonitorCheckoutWindow({popup, confirmationId});

        return { confirmationId, url: url.toString() };
      }

      const checkoutId = `nft-marketplace:${confirmationId}`;
      const rootUrl = new URL(UrlJoin(window.location.origin, window.location.pathname)).toString();

      this.rootStore.SetSessionStorage("successPath", UrlJoin(basePath, "success"));
      this.rootStore.SetSessionStorage("cancelPath", UrlJoin(basePath, "cancel"));

      this.rootStore.SetSessionStorage("purchaseType", "listing");

      let requestParams = {
        currency: this.currency,
        email,
        client_reference_id: checkoutId,
        elv_addr: this.client.CurrentAccountAddress(),
        items: [{sku: listingId, quantity: 1}],
        success_url: UrlJoin(rootUrl.toString(), "/#/", "success"),
        cancel_url: UrlJoin(rootUrl.toString(), "/#/", "cancel")
      };

      if(EluvioConfiguration["mode"]) {
        requestParams.mode = EluvioConfiguration["mode"];
      }

      yield this.CheckoutRedirect({provider, requestParams, confirmationId});

      this.PurchaseComplete({confirmationId, success: true});

      return { confirmationId, successPath: UrlJoin(basePath, "success") };
    } catch(error) {
      this.rootStore.Log(error, true);

      if(popup) { popup.close(); }

      this.PurchaseComplete({confirmationId, success: false, message: "Listing purchase failed"});

      if(typeof error.recoverable !== "undefined") {
        throw error;
      } else {
        throw {
          recoverable: true,
          uiMessage: error.uiMessage || "Purchase failed"
        };
      }
    } finally {
      this.submittingOrder = false;
    }
  });

  CheckoutSubmit = flow(function * ({
    provider="stripe",
    tenantId,
    marketplaceId,
    sku,
    quantity=1,
    confirmationId,
    email
  }) {
    if(this.submittingOrder) { return; }

    const requiresPopup = this.rootStore.embedded && !["wallet-balance", "linked-wallet"].includes(provider);
    confirmationId = confirmationId || `M-${this.ConfirmationId()}`;

    let popup;
    try {
      if(requiresPopup) {
        popup = window.open("about:blank");
      }

      this.submittingOrder = true;

      let authInfo = this.rootStore.AuthInfo();
      if(!authInfo.user) {
        authInfo.user = {};
      }

      email = email || (authInfo.user || {}).email || this.rootStore.userProfile.email;
      authInfo.user.email = email;

      const basePath = UrlJoin("/marketplace", marketplaceId, "store", tenantId, sku, "purchase", confirmationId);

      if(!email) {
        throw {
          recoverable: false,
          message: "Unable to determine email address in checkout submit"
        };
      }

      const stock = (yield this.MarketplaceStock({tenantId}) || {})[sku];
      if(stock && (stock.max - stock.minted) < quantity) {
        throw {
          recoverable: true,
          message: `Quantity ${quantity} exceeds stock ${stock.max - stock.minted} for ${sku}`,
          uiMessage: "Insufficient stock available for this purchase"
        };
      }

      this.PurchaseInitiated({confirmationId, tenantId, marketplaceId, sku});

      if(requiresPopup) {
        // Stripe doesn't work in iframe, open new window to initiate purchase
        const url = new URL(window.location.origin);
        url.pathname = window.location.pathname;
        url.hash = basePath;
        url.searchParams.set("embed", "");
        url.searchParams.set("provider", provider);
        url.searchParams.set("tenantId", tenantId);
        url.searchParams.set("quantity", quantity);

        if(!this.rootStore.darkMode) {
          url.searchParams.set("lt", "");
        }

        url.searchParams.set("auth", Utils.B64(JSON.stringify(authInfo)));

        popup.location.href = url.toString();

        this.MonitorCheckoutWindow({popup, confirmationId});

        return { confirmationId, url: url.toString() };
      }

      const checkoutId = `${marketplaceId}:${confirmationId}`;

      const rootUrl = new URL(UrlJoin(window.location.origin, window.location.pathname)).toString();

      this.rootStore.SetSessionStorage("successPath", UrlJoin(basePath.toString(), "success"));
      this.rootStore.SetSessionStorage("cancelPath", UrlJoin(basePath.toString(), "cancel"));

      this.rootStore.SetSessionStorage("purchaseType", "store");

      let requestParams = {
        currency: this.currency,
        email,
        client_reference_id: checkoutId,
        elv_addr: this.client.CurrentAccountAddress(),
        items: [{sku, quantity}],
        success_url: UrlJoin(rootUrl.toString(), "/#/", "success"),
        cancel_url: UrlJoin(rootUrl.toString(), "/#/", "cancel")
      };

      if(EluvioConfiguration["mode"]) {
        requestParams.mode = EluvioConfiguration["mode"];
      }

      yield this.CheckoutRedirect({provider, requestParams, confirmationId});

      this.PurchaseComplete({confirmationId, success: true});

      return { confirmationId, successPath: UrlJoin(basePath, "success") };
    } catch(error) {
      if(popup) { popup.close(); }

      this.rootStore.Log(error, true);

      this.PurchaseComplete({confirmationId, success: false, message: "Purchase failed"});

      if(typeof error.recoverable !== "undefined") {
        throw error;
      } else {
        throw {
          recoverable: true,
          uiMessage: error.uiMessage || "Purchase failed"
        };
      }
    } finally {
      this.submittingOrder = false;
    }
  });

  MonitorCheckoutWindow({popup, confirmationId}) {
    const closeCheck = setInterval(() => {
      if(!this.pendingPurchases[confirmationId]) {
        clearInterval(closeCheck);

        return;
      }

      if(!popup || popup.closed) {
        clearInterval(closeCheck);

        // Ensure pending is cleaned up when popup is closed without finishing
        runInAction(() => delete this.pendingPurchases[confirmationId]);
      }
    }, 1000);
  }

  CheckoutRedirect = flow(function * ({provider, requestParams, confirmationId}) {
    if(provider === "stripe") {
      const sessionId = (yield this.client.utils.ResponseToJson(
        this.client.authClient.MakeAuthServiceRequest({
          method: "POST",
          path: UrlJoin("as", "checkout", "stripe"),
          body: requestParams
        })
      )).session_id;

      const stripeKey = EluvioConfiguration.mode && EluvioConfiguration.mode !== "production" ?
        PUBLIC_KEYS.stripe.test :
        PUBLIC_KEYS.stripe.production;

      // Redirect to stripe
      const {loadStripe} = yield import("@stripe/stripe-js/pure");
      const stripe = yield loadStripe(stripeKey);
      yield stripe.redirectToCheckout({sessionId});
    } else if(provider === "coinbase") {
      const chargeCode = (yield this.client.utils.ResponseToJson(
        this.client.authClient.MakeAuthServiceRequest({
          method: "POST",
          path: UrlJoin("as", "checkout", "coinbase"),
          body: requestParams
        })
      )).charge_code;

      window.location.href = UrlJoin("https://commerce.coinbase.com/charges", chargeCode);
    } else if(provider === "wallet-balance") {
      yield this.client.authClient.MakeAuthServiceRequest({
        method: "POST",
        path: UrlJoin("as", "wlt", "mkt", "bal", "pay"),
        body: requestParams,
        headers: {
          Authorization: `Bearer ${this.client.signer.authToken}`
        }
      });

      setTimeout(() => this.rootStore.GetWalletBalance(), 1000);
    } else if(provider === "linked-wallet") {
      if(!this.rootStore.embedded) {
        yield this.rootStore.cryptoStore.PhantomBalance();
      }

      if(!(this.rootStore.cryptoStore.phantomBalance > 0)) {
        throw {
          recoverable: false,
          uiMessage: "Solana account has insufficient balance to perform this transaction"
        };
      }

      const response = (yield this.client.utils.ResponseToJson(
        this.client.authClient.MakeAuthServiceRequest({
          method: "POST",
          path: UrlJoin("as", "checkout", "solana"),
          body: requestParams
        })
      ));

      const signature = yield this.rootStore.cryptoStore.PurchasePhantom(response.params[0]);

      this.solanaSignatures[confirmationId] = signature;

      this.rootStore.SetSessionStorage("solana-signatures", JSON.stringify(this.solanaSignatures));

      this.rootStore.Log("Purchase transaction signature: " + signature);
    } else {
      throw Error("Invalid provider: " + provider);
    }
  });
}

export default CheckoutStore;
