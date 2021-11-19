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

  get client() {
    return this.rootStore.client;
  }

  constructor(rootStore) {
    this.rootStore = rootStore;
    makeAutoObservable(this);
  }

  ConfirmationId() {
    return Utils.B58(UUIDParse(UUID()));
  }

  MarketplaceStock = flow(function * ({tenantId}) {
    try {
      this.stock = yield Utils.ResponseToJson(
        this.client.authClient.MakeAuthServiceRequest({
          path: UrlJoin("as", "wlt", "nft", "info", tenantId),
          method: "GET",
          headers: {
            Authorization: `Bearer ${this.client.signer.authToken}`
          }
        })
      );

      return this.stock;
    } catch(error) {
      this.rootStore.Log("Failed to retrieve marketplace stock", true);
      this.rootStore.Log(error, true);
    }
  });

  PurchaseComplete({confirmationId, success}) {
    this.submittingOrder = false;

    if(success) {
      this.completedPurchases[confirmationId] = {
        ...(this.pendingPurchases[confirmationId] || {})
      };
    }

    delete this.pendingPurchases[confirmationId];
  }

  ClaimSubmit = flow(function * ({marketplaceId, sku}) {
    try {
      this.submittingOrder = true;

      const tenantId = this.rootStore.marketplaces[marketplaceId].tenant_id;

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

      return true;
    } catch(error) {
      this.rootStore.Log(error, true);

      return false;
    } finally {
      this.submittingOrder = false;
    }
  });

  CheckoutSubmit = flow(function * ({provider="stripe", tenantId, marketplaceId, sku, quantity=1, confirmationId, email}) {
    if(this.submittingOrder) { return; }

    try {
      this.submittingOrder = true;

      // If confirmation ID is already set before calling, this method was called as a result of an iframe opening a new window
      const fromEmbed = !!confirmationId;

      confirmationId = confirmationId || this.ConfirmationId();

      let authInfo = this.rootStore.AuthInfo();
      if(!authInfo.user) { authInfo.user = {}; }
      email = email || (authInfo.user || {}).email || this.rootStore.userProfile.email;
      authInfo.user.email = email;

      if(!email) {
        throw Error("Unable to determine email address in checkout submit");
      }

      if(this.rootStore.embedded) {
        this.pendingPurchases[confirmationId] = {
          marketplaceId,
          sku,
          confirmationId
        };

        // Stripe doesn't work in iframe, open new window to initiate purchase
        const url = new URL(window.location.origin);
        url.pathname = window.location.pathname;
        url.hash = `/marketplaces/${marketplaceId}/${sku}/purchase/${confirmationId}`;
        url.searchParams.set("embed", "");
        url.searchParams.set("provider", provider);
        url.searchParams.set("tenantId", tenantId);
        url.searchParams.set("quantity", quantity);

        if(rootStore.darkMode) {
          url.searchParams.set("d", "");
        }

        url.searchParams.set("auth", Utils.B64(JSON.stringify(authInfo)));

        const openedWindow = window.open(url.toString());

        const closeCheck = setInterval(() => {
          if(!this.pendingPurchases[confirmationId]) {
            clearInterval(closeCheck);

            return;
          }

          if(!openedWindow || openedWindow.closed) {
            clearInterval(closeCheck);

            // Ensure pending is cleaned up when popup is closed without finishing
            runInAction(() => delete this.pendingPurchases[confirmationId]);
          }
        }, 1000);

        return confirmationId;
      }

      const checkoutId = `${marketplaceId}:${confirmationId}`;

      const rootUrl = new URL(UrlJoin(window.location.origin, window.location.pathname)).toString();
      const baseUrl = new URL(UrlJoin(window.location.origin, window.location.pathname, "#", "marketplaces", marketplaceId, sku, "purchase", confirmationId));

      if(fromEmbed) {
        baseUrl.searchParams.set("embed", "true");
      }

      sessionStorage.setItem("successUrl", UrlJoin(baseUrl.toString(), "success"));
      sessionStorage.setItem("cancelUrl", UrlJoin(baseUrl.toString(), "cancel"));

      let requestParams = {
        currency: this.currency,
        email,
        client_reference_id: checkoutId,
        elv_addr: this.client.signer.address,
        items: [{sku, quantity}],
        success_url: UrlJoin(rootUrl.toString(), "/#/", "success"),
        cancel_url: UrlJoin(rootUrl.toString(), "/#/", "cancel")
      };

      if(EluvioConfiguration["mode"]) {
        requestParams.mode = EluvioConfiguration["mode"];
      }

      const stock = (yield this.MarketplaceStock({tenantId}) || {})[sku];

      if(stock && (stock.max - stock.minted) < quantity) {
        throw Error(`Quantity ${quantity} exceeds stock ${stock.max - stock.minted} for ${sku}`);
      }

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
        loadStripe.setLoadParameters({advancedFraudSignals: false});
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
      }
    } catch(error) {
      this.rootStore.Log(error, true);
    } finally {
      this.submittingOrder = false;
    }
  });
}

export default CheckoutStore;
