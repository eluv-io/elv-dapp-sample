import {checkoutStore, rootStore, transferStore} from "Stores/index";
import {toJS} from "mobx";
import Utils from "@eluvio/elv-client-js/src/Utils";
import EVENTS from "../../../client/src/Events";
import UrlJoin from "url-join";

const pages = {
  // Wallet
  "wallet": "/wallet",
  "items": "/wallet/collection",
  "item": "/wallet/collection/:contractId/:tokenId",
  "tickets": "/wallet/tickets",
  "tokens": "/wallet/tokens",

  // Profile
  "profile": "/profile",

  // Marketplace
  "marketplaces": "/marketplaces",
  "marketplace": "/marketplace/:marketplaceId/store",
  "marketplaceItem": "/marketplace/:marketplaceId/store/:sku",
  "marketplaceWallet": "/marketplace/:marketplaceId/collection",
  "marketplaceListings": "/marketplace/:marketplaceId/listings",
  "drop": "/marketplace/:marketplaceId/events/:tenantSlug/:eventSlug/:dropId",

  // Listings
  "listings": "/wallet/listings"
};

const FormatNFT = (nft) => {
  if(!nft || !nft.metadata) { return; }

  return toJS(nft);
};

const Target = () => {
  if(rootStore.embedded) {
    // In iframe
    return window.top;
  } else if(window.opener) {
    // Popup
    return window.opener;
  }
};

export const InitializeListener = (history) => {
  const target = Target();

  if(!target) { return; }

  const Listener = async event => {
    if(!event || !event.data || event.data.type !== "ElvMediaWalletClientRequest") { return; }
    const data = event.data;

    const Respond = ({response, error}) => {
      if(!target) { return; }

      target.postMessage({
        type: "ElvMediaWalletResponse",
        requestId: data.requestId,
        response: Utils.MakeClonable(response),
        error: Utils.MakeClonable(error)
      }, "*");
    };

    switch(data.action) {
      case "login":
        await rootStore.Authenticate({
          idToken: data.params.idToken,
          authToken: data.params.authToken,
          privateKey: data.params.privateKey,
          user: data.params.user,
          tenantId: data.params.tenantId
        });

        Respond({});

        break;

      case "logout":
        await rootStore.SignOut();

        Respond({});

        break;

      case "purchase":
        checkoutStore.PurchaseComplete({
          confirmationId: data.params.confirmationId,
          success: data.params.success,
          message: data.params.message
        });

        break;
      case "profile":
        if(!rootStore.loggedIn) {
          Respond({response: null});
        }

        Respond({response: toJS(rootStore.userProfile)});

        break;
      case "items":
        await rootStore.LoadNFTInfo();

        if((data.params.contractAddress || data.params.contractId) && data.params.tokenId) {
          Respond({response: await FormatNFT(rootStore.LoadNFTData({contractAddress: data.params.contractAddress, contractId: data.params.contractId, tokenId: data.params.tokenId}))});
        } else {
          Respond({response: (await transferStore.FilteredQuery({mode: "owned", limit: 10000, start: 0})).results || []});
        }

        break;
      case "toggleNavigation":
        rootStore.ToggleNavigation(data.params.enabled);

        break;
      case "toggleSidePanelMode":
        rootStore.ToggleSidePanelMode(data.params.enabled);

        break;

      case "toggleDarkMode":
        rootStore.ToggleDarkMode(data.params.enabled);

        break;

      case "marketplaceMetadata":
        // Ensure marketplace is loaded
        const { marketplaceId } = await rootStore.MarketplaceInfo({
          tenantSlug: data.params.tenantSlug,
          marketplaceSlug: data.params.marketplaceSlug,
          marketplaceId: data.params.marketplaceId,
          marketplaceHash: data.params.marketplaceHash
        });

        Respond({
          response: await rootStore.LoadMarketplace(marketplaceId)
        });

        break;

      case "eventMetadata":
        Respond({
          response: await rootStore.LoadEvent({
            tenantSlug: data.params.tenantSlug,
            eventSlug: data.params.eventSlug,
            eventId: data.params.eventId,
            eventHash: data.params.eventHash
          })
        });

        break;

      case "setMarketplace":
        // Ensure marketplace is loaded
        await rootStore.MarketplaceInfo({
          tenantSlug: data.params.tenantSlug,
          marketplaceSlug: data.params.marketplaceSlug,
          marketplaceId: data.params.marketplaceId,
          marketplaceHash: data.params.marketplaceHash
        });

        const marketplaceHash = await rootStore.SetMarketplace({
          tenantSlug: data.params.tenantSlug,
          marketplaceSlug: data.params.marketplaceSlug,
          marketplaceId: data.params.marketplaceId,
          marketplaceHash: data.params.marketplaceHash
        });

        Respond({response: marketplaceHash});

        break;
      case "setMarketplaceFilters":
        await rootStore.SetMarketplaceFilters(data.params.filters);

        Respond({});

        break;
      case "setActive":
        rootStore.WalletActivated();

        break;

      case "currentPath":
        const pathname = UrlJoin("/", window.location.hash.replace("#", ""));

        Respond({response: pathname});

        break;
      case "navigate":
        rootStore.SetMarketplaceFilters(data.params.marketplaceFilters || []);

        let route;
        if(data.params.path === "/login" || data.params.page === "login") {
          rootStore.ShowLogin({requireLogin: data.params.loginRequired});

          route = "/login";
        } else if(data.params.path) {
          // Direct path
          history.push(data.params.path);

          route = data.params.path;
        } else {
          // Named page
          if(!pages[data.params.page]) {
            rootStore.Log(`Unknown page: ${data.params.page}`);
            Respond({error: `Unknown page: ${data.params.page}`});
            return;
          }

          // Replace route variables
          route = pages[data.params.page];

          const params = (data.params || {}).params;
          if(params) {
            if(params.marketplaceSlug || params.marketplaceHash || params.marketplaceId) {
              // Ensure marketplace is loaded
              await rootStore.MarketplaceInfo({
                tenantSlug: params.tenantSlug,
                marketplaceSlug: params.marketplaceSlug,
                marketplaceId: params.marketplaceId,
                marketplaceHash: params.marketplaceHash
              });

              await rootStore.SetMarketplace({
                tenantSlug: params.tenantSlug,
                marketplaceSlug: params.marketplaceSlug,
                marketplaceId: params.marketplaceId,
                marketplaceHash: params.marketplaceHash
              });

              params.marketplaceId = rootStore.marketplaceId;
            }

            Object.keys(params).forEach(key => {
              route = route.replace(`:${key}`, params[key]);
            });
          }

          history.push(route);
        }

        Respond({
          response: route
        });

        break;
      default:
        rootStore.Log(`Unknown action: ${data.action}`);
        Respond({error: `Unknown action: ${data.action}`});
    }
  };

  window.addEventListener("message", Listener);
  window.onbeforeunload = () => {
    if(!rootStore.disableCloseEvent) {
      SendEvent({event: EVENTS.CLOSE});
    }
    window.removeEventListener("message", Listener);
  };

  target.postMessage({
    type: "ElvMediaWalletResponse",
    requestId: "init"
  }, "*");
};

export const SendEvent = ({event, data}) => {
  const target = Target();

  if(!target) { return; }

  target.postMessage({
    type: "ElvMediaWalletEvent",
    event,
    data: Utils.MakeClonable(data)
  }, "*");
};
