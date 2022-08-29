
export class MarketplaceLoader {

  constructor(wallet, curMarketplaceParams) {
    this.walletClient = wallet;
    this.marketplaceParams = curMarketplaceParams;
  }

  toMarketplaceString(t, m) {
    return "Selected Marketplace: " + t + "/" + m;
  }

  async loadMarketplaces() {
    window.console.log("*** loadMarketplaces ***", this.walletClient);
    await this.walletClient.AvailableMarketplaces()
      .catch(err => { return err; })
      .then(marketplaces => {
        let select = document.getElementById("marketplaceSelector");
        let defaultOption = document.getElementById("defaultMarketplaceOption");
        if(defaultOption == undefined) {
          return;
        } else {
          defaultOption?.remove();
        }
        for(const rm of document.getElementsByClassName("mkOption")) {
          rm?.remove();
        }
        window.console.log("marketplaces[", marketplaces.length, "]:", marketplaces);
        for(const [_, cContents] of Object.entries(marketplaces)) {
          for(const [_, value] of Object.entries(cContents)) {
            if(typeof value === "object" && "marketplaceSlug" in value && "tenantSlug" in value) {
              window.console.log(value.tenantSlug, value.marketplaceSlug);
              let el = document.createElement("option");
              el.textContent = this.toMarketplaceString(value.tenantSlug, value.marketplaceSlug);
              el.value = value.tenantSlug + "/" + value.marketplaceSlug;
              el.className = "mkOption";
              select.appendChild(el);
            }
          }
        }
        select.value = this.marketplaceParams.tenantSlug + "/" + this.marketplaceParams.marketplaceSlug;
      });
  }

  setMarketplace(event) {
    const [tenant, market] = event.target.value.split("/");
    const url = new URL(window.location.href);

    url.searchParams.set("tenant-name", tenant);
    url.searchParams.set("marketplace-name", market);
    window.history.replaceState("", "", url.toString());
    window.location = url;
  };

}
