import React, {useState, useEffect} from "react";
import {rootStore, checkoutStore} from "Stores/index";
import {
  Switch,
  Route,
  Link,
  useRouteMatch,
  NavLink, Redirect,
} from "react-router-dom";
import UrlJoin from "url-join";
import Path from "path";
import AsyncComponent from "Components/common/AsyncComponent";
import NFTPlaceholderIcon from "Assets/icons/nft";
import StripeLogo from "Assets/images/logo-stripe.png";
import ImageIcon from "Components/common/ImageIcon";
import {CopyableField, ExpandableSection, FormatPriceString, ItemPrice} from "Components/common/UIComponents";
import {observer} from "mobx-react";
import Drop from "Components/event/Drop";
import {MarketplaceImage, NFTImage} from "Components/common/Images";
import NFTDetails from "Components/wallet/NFTDetails";
import {DropMintingStatus, PackOpenStatus, PurchaseMintingStatus} from "Components/marketplace/MintingStatus";
import {Loader, PageLoader} from "Components/common/Loaders";

const MarketplaceNavigation = observer(() => {
  let match = useRouteMatch();

  const marketplace = rootStore.marketplaces[match.params.marketplaceId];

  return (
    <nav className="sub-navigation marketplace-navigation">
      <NavLink className="sub-navigation__link" to={`/marketplaces/${match.params.marketplaceId}/store`}>Store</NavLink>
      {
        marketplace && marketplace.collections && marketplace.collections.length > 0 ?
          <NavLink className="sub-navigation__link" to={`/marketplaces/${match.params.marketplaceId}/collections`}>Collections</NavLink> :
          null
      }
      <NavLink className="sub-navigation__link" to={`/marketplaces/${match.params.marketplaceId}/owned`}>My Collection</NavLink>
    </nav>
  );
});

const ValidEmail = email => {
  return /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
    .test(email);
};

const Checkout = observer(({marketplaceId, item}) => {
  const subtotal = ItemPrice(item, checkoutStore.currency);
  const platformFee = parseFloat((subtotal * 0.1).toFixed(2));
  const total = subtotal + platformFee;

  const [email, setEmail] = useState("");
  const [validEmail, setValidEmail] = useState(false);
  const [confirmationId, setConfirmationId] = useState(undefined);

  if(confirmationId && checkoutStore.completedPurchases[confirmationId]) {
    return <Redirect to={UrlJoin("/marketplaces", marketplaceId, "store", item.sku, "purchase", confirmationId, "success")} />;
  }

  return (
    <div className="checkout">
      <div className="checkout__totals card-shadow">
        <div className="checkout__totals__row">
          <label className="checkout__totals__row__label">Subtotal</label>
          <div className="checkout__totals__row__price">
            { FormatPriceString({[checkoutStore.currency]: subtotal}) }
          </div>
        </div>
        <div className="checkout__totals__row">
          <label className="checkout__totals__row__label">Platform Fee</label>
          <div className="checkout__totals__row__price">
            { FormatPriceString({[checkoutStore.currency]: platformFee}) }
          </div>
        </div>
        <div className="checkout__totals__row">
          <label className="checkout__totals__row__label">Subtotal</label>
          <div className="checkout__totals__row__price">
            { FormatPriceString({[checkoutStore.currency]: total}) }
          </div>
        </div>
      </div>

      <div className="checkout__payment-actions">
        {
          !rootStore.userProfile.email ?
            <input
              type="text"
              className="checkout__email"
              value={email}
              placeholder="Email Address"
              onChange={event => {
                const email = event.target.value.trim();
                setEmail(email);
                setValidEmail(ValidEmail(email));
              }}
            /> : null
        }
        {
          checkoutStore.submittingOrder || (confirmationId && checkoutStore.pendingPurchases[confirmationId]) ?
            <Loader/> :
            <button
              disabled={!rootStore.userProfile.email && !validEmail}
              className="checkout-button"
              role="link"
              onClick={async () => {
                setConfirmationId(await checkoutStore.StripeSubmit({marketplaceId, sku: item.sku, email}));
              }}
            >
              Buy Now
              <img className="stripe-checkout-logo" src={StripeLogo} alt="Stripe Logo"/>
            </button>
        }
      </div>
    </div>
  );
});

const MarketplacePurchase = observer(() => {
  const match = useRouteMatch();

  const fromEmbed = new URLSearchParams(window.location.search).has("embed");
  const success = match.path.endsWith("/success");
  const cancel = match.path.endsWith("/cancel");

  if(fromEmbed && (success || cancel)) {
    useEffect(() => {
      window.opener.postMessage({
        type: "ElvMediaWalletClientRequest",
        action: "purchase",
        params: {
          confirmationId: match.params.confirmationId,
          success
        }
      });

      window.close();
    }, []);
  }

  if(fromEmbed) {
    return <PageLoader />;
  } else if(success) {
    return <PurchaseMintingStatus />;
  } else if(cancel) {
    return <Redirect to={Path.dirname(Path.dirname(match.path.url))}/>;
  } else {
    // Opened from iframe - Initiate stripe purchase
    useEffect(() => {
      rootStore.ToggleNavigation(false);

      const args = new URLSearchParams(window.location.search);
      const email = args.has("e") ? rootStore.client.utils.FromB64(args.get("e")) : "";

      checkoutStore.StripeSubmit({
        marketplaceId: match.params.marketplaceId,
        sku: match.params.sku,
        confirmationId: match.params.confirmationId,
        email
      });
    }, []);

    return <PageLoader/>;
  }
});

const MarketplaceItemDetails = observer(() => {
  const match = useRouteMatch();

  const marketplace = rootStore.marketplaces[match.params.marketplaceId];

  if(!marketplace) { return null; }

  const itemIndex = marketplace.items.findIndex(item => item.sku === match.params.sku);

  if(itemIndex < 0) { return null; }

  const item = marketplace.items[itemIndex];
  const itemTemplate = item.nft_template ? item.nft_template.nft : {};

  const stock = checkoutStore.stock[item.sku];

  useEffect(() => {
    if(!stock) { return; }

    checkoutStore.MarketplaceStock();

    // If item has stock, periodically update
    const stockCheck = setInterval(() => checkoutStore.MarketplaceStock(), 7500);

    return () => clearInterval(stockCheck);
  }, []);

  return (
    <div className="details-page">
      <div className="details-page__content-container card-container">
        <div className="details-page__content card card-shadow">
          <MarketplaceImage
            templateImage
            marketplaceHash={marketplace.versionHash}
            item={item}
            path={UrlJoin("public", "asset_metadata", "info", "items", itemIndex.toString(), "image")}
            className="details-page__content__image"
          />
          <h2 className="card__title">
            { item.name }
          </h2>
          <div className="card__subtitle">
            <div className="card__subtitle__title">
              { item.description }
            </div>
            {
              stock ?
                <div className="card__subtitle__stock">
                  { stock.Max - stock.Current } Left!
                </div> : null
            }
          </div>
        </div>
      </div>

      <div className="details-page__info">
        <ExpandableSection header="Description">
          { itemTemplate.description || item.description }
        </ExpandableSection>

        <ExpandableSection header="Details">
          {
            itemTemplate.embed_url ?
              <CopyableField value={itemTemplate.embed_url}>
                Media URL: { itemTemplate.embed_url }
              </CopyableField>
              : null
          }
          {
            itemTemplate.creator ?
              <div>
                Creator: { itemTemplate.creator }
              </div>
              : null
          }
          {
            itemTemplate.total_supply ?
              <div>
                Total Supply: { itemTemplate.total_supply }
              </div>
              : null
          }
          <br />
          <div>
            { itemTemplate.copyright }
          </div>
        </ExpandableSection>

        {
          itemTemplate.address ?
            <ExpandableSection header="Contract">
              <CopyableField value={itemTemplate.address}>
                Contract Address: {itemTemplate.address}
              </CopyableField>
              <div>
                <a
                  className="lookout-url"
                  target="_blank"
                  href={`https://lookout.qluv.io/address/${itemTemplate.address}/transactions`} rel="noopener"
                >
                  See More Info on Eluvio Lookout
                </a>
              </div>
            </ExpandableSection> : null
        }

        <Checkout marketplaceId={match.params.marketplaceId} item={item} />
      </div>
    </div>
  );
});

const MarketplaceItemCard = ({marketplaceHash, to, item, index, className=""}) => {
  const match = useRouteMatch();

  if(!item.for_sale || (item.type === "nft" && (!item.nft_template || item.nft_template["/"]))) {
    return null;
  }

  const stock = checkoutStore.stock[item.sku];
  return (
    <div className={`card-container card-shadow ${className}`}>
      <Link
        to={to || `${match.url}/${item.sku}`}
        className="card nft-card"
      >
        <MarketplaceImage
          marketplaceHash={marketplaceHash}
          item={item}
          path={UrlJoin("public", "asset_metadata", "info", "items", index.toString(), "image")}
        />
        <div className="card__text">
          <h2 className="card__title">
            <div className="card__title__title">
              { item.name }
            </div>
            <div className="card__title__price">
              { FormatPriceString(item.price) }
            </div>
          </h2>
          <h2 className="card__subtitle">
            <div className="card__subtitle__title">
              { item.description }
            </div>
            {
              stock ?
                <div className="card__subtitle__stock">
                  { stock.Max - stock.Current } Left!
                </div> : null
            }
          </h2>
        </div>
      </Link>
    </div>
  );
};


const MarketplaceOwned = observer(() => {
  const match = useRouteMatch();

  const marketplace = rootStore.marketplaces[match.params.marketplaceId];

  if(!marketplace) { return null; }

  const ownedItems = rootStore.nfts.filter(nft =>
    marketplace.items.find(item =>
      item.nft_template && !item.nft_template["/"] && item.nft_template.nft && item.nft_template.nft.template_id && item.nft_template.nft.template_id === nft.metadata.template_id
    )
  );

  return (
    ownedItems.length === 0 ?
      <h2 className="marketplace__empty">You don't own any items from this marketplace yet!</h2> :
      <div className="card-list">
        {
          ownedItems.map(ownedItem =>
            <div className="card-container card-shadow" key={`marketplace-owned-item-${ownedItem.details.ContractAddr}-${ownedItem.details.TokenIdStr}`}>
              <Link
                to={UrlJoin(match.url, ownedItem.details.ContractId, ownedItem.details.TokenIdStr)}
                className="card nft-card"
              >
                <NFTImage nft={ownedItem} className="card__image" width={400} />
                <h2 className="card__title">
                  { ownedItem.metadata.display_name || "" }
                </h2>
                <h2 className="card__subtitle">
                  { ownedItem.metadata.display_name || "" }
                </h2>
              </Link>
            </div>
          )
        }
      </div>
  );
});

const MarketplaceCollections = observer(() => {
  const match = useRouteMatch();
  const marketplace = rootStore.marketplaces[match.params.marketplaceId];

  if(!marketplace) { return null; }

  let ownedIds = {};
  rootStore.nfts.forEach(nft => ownedIds[rootStore.client.utils.DecodeVersionHash(nft.details.versionHash).objectId] = nft);

  let purchaseableItems = {};
  marketplace.storefront.sections.forEach(section =>
    section.items.forEach(sku => {
      const itemIndex = marketplace.items.findIndex(item => item.sku === sku);
      const item = marketplace.items[itemIndex];

      if(!item || !item.for_sale || (item.requires_permissions && !item.authorized)) { return; }

      purchaseableItems[sku] = {
        item,
        index: itemIndex
      };
    })
  );

  return marketplace.collections.map((collection, collectionIndex) => {
    let owned = 0;
    const collectionItems = collection.items.map((sku, entryIndex) => {
      const key = `collection-card-${collectionIndex}-${entryIndex}`;
      const itemIndex = marketplace.items.findIndex(item => item.sku === sku);
      const item = marketplace.items[itemIndex];

      if(!item) { return; }

      let versionHash;
      if(item.nft_template["/"]) {
        versionHash = item.nft_template["/"].split("/").find(component => component.startsWith("hq__"));
      } else if(item.nft_template["."] && item.nft_template["."].source) {
        versionHash = item.nft_template["."].source;
      }

      const templateId = versionHash ? rootStore.client.utils.DecodeVersionHash(versionHash).objectId : undefined;

      if(ownedIds[templateId]) {
        owned += 1;

        return (
          <div className="card-container card-shadow" key={key}>
            <Link
              to={UrlJoin(match.url, collectionIndex.toString(), "owned", ownedIds[templateId].details.ContractId, ownedIds[templateId].details.TokenIdStr)}
              className="card nft-card"
            >
              <NFTImage nft={ownedIds[templateId]} className="card__image" width={400} />
              <h2 className="card__title">
                { ownedIds[templateId].metadata.display_name || "" }
              </h2>
              <h2 className="card__subtitle">
                { ownedIds[templateId].metadata.display_name || "" }
              </h2>
            </Link>
          </div>
        );
      } else if(purchaseableItems[sku]) {
        return (
          <MarketplaceItemCard
            to={`${match.url}/${collectionIndex}/store/${purchaseableItems[sku].item.sku}`}
            className="collection-card collection-card-purchasable collection-card-unowned"
            marketplaceHash={marketplace.versionHash}
            item={purchaseableItems[sku].item}
            index={purchaseableItems[sku].index}
            key={key}
          />
        );
      } else {
        // Not accessible, use placeholder
        return (
          <div className="card-container card-shadow collection-card collection-card-inaccessible collection-card-unowned" key={key}>
            <div className="card nft-card">
              {
                item.image ?
                  <MarketplaceImage
                    marketplaceHash={marketplace.versionHash}
                    title={item.name}
                    path={UrlJoin("public", "asset_metadata", "info", "items", itemIndex.toString(), "image")}
                  /> :
                  <div className="nft-image card__image card__image-placeholder"/>
              }
              <h2 className="card__title">
                { item.name }
              </h2>
              <h2 className="card__subtitle">
                { item.description }
              </h2>
            </div>
          </div>
        );
      }
    });

    return (
      <div className="marketplace__section" key={`marketplace-section-${collectionIndex}`}>
        <h1 className="page-header">
          <div className="page-header__title">{collection.collection_header}</div>
          <div className="page-header__subtitle">{ owned } / { collection.items.length }</div>
        </h1>
        <h2 className="page-subheader">{collection.collection_subheader}</h2>
        <div className="card-list card-list-collections">
          { collectionItems }
        </div>
      </div>
    );
  });
});

const Marketplace = observer(() => {
  const match = useRouteMatch();
  const marketplace = rootStore.marketplaces[match.params.marketplaceId];

  if(!marketplace) { return null; }

  return (
    <>
      {
        marketplace.storefront.sections.map((section, sectionIndex) => {
          const items = section.items.map((sku) => {
            const itemIndex = marketplace.items.findIndex(item => item.sku === sku);
            const item = itemIndex >= 0 && marketplace.items[itemIndex];

            if(
              !item ||
              !item.for_sale ||
              (item.requires_permissions && !item.authorized) ||
              (item.type === "nft" && (!item.nft_template || item.nft_template["/"]))) {
              return;
            }

            // If filters are specified, item must have all tags
            if(rootStore.marketplaceFilters.length > 0 && rootStore.marketplaceFilters.find(filter => !(item.tags || []).includes(filter))) {
              return;
            }

            return { item, itemIndex };
          }).filter(item => item);

          if(items.length === 0) { return null; }

          return (
            <div className="marketplace__section" key={`marketplace-section-${sectionIndex}`}>
              <h1 className="page-header">{section.section_header}</h1>
              <h2 className="page-subheader">{section.section_subheader}</h2>
              <div className="card-list">
                {
                  items.map(({item, itemIndex}) =>
                    <MarketplaceItemCard
                      marketplaceHash={marketplace.versionHash}
                      item={item}
                      index={itemIndex}
                      key={`marketplace-item-${itemIndex}`}
                    />
                  )
                }
              </div>
            </div>
          );
        })
      }

      {
        /*
        marketplace.events.length === 0 ? null :
          <div className="marketplace__section">
            <h1 className="page-header">Events</h1>
            <div className="card-list">
              {
                marketplace.drops.map((drop, index) => (
                  <div className="card-container card-shadow" key={`drop-card-${index}`}>
                    <Link
                      to={`${Path.dirname(match.url)}/events/${drop.uuid}`}
                      className="card nft-card"
                    >
                      <MarketplaceImage
                        marketplaceHash={marketplace.versionHash}
                        title={drop.event_header}
                        path={UrlJoin("public", "asset_metadata", "info", "events", drop.eventIndex.toString(), "event", "info", "drops", drop.dropIndex.toString(), "event_image")}
                      />
                      <div className="card__text">
                        <h2 className="card__title">
                          <div className="card__title__title">
                            { drop.event_header }
                          </div>
                        </h2>
                      </div>
                    </Link>
                  </div>
                ))
              }
            </div>
          </div>
         */
      }
    </>
  );
});

const MarketplacePage = observer(({children}) => {
  const match = useRouteMatch();

  const marketplace = rootStore.marketplaces[match.params.marketplaceId];

  if(!marketplace) { return null; }

  if(rootStore.hideNavigation) {
    return (
      <div className="marketplace content">
        { children }
      </div>
    );
  }

  return (
    <div className="marketplace content">
      <div className="marketplace__header">
        <h1 className="page-header">{ marketplace.storefront.header }</h1>
        <h2 className="page-subheader">{ marketplace.storefront.subheader }</h2>
      </div>
      <MarketplaceNavigation />
      { children }
    </div>
  );
});

const MarketplaceWrapper = observer(({children}) => {
  const match = useRouteMatch();

  return (
    <AsyncComponent
      Load={async () => {
        await rootStore.LoadMarketplace(match.params.marketplaceId);
        await rootStore.LoadWalletCollection();
      }}
      loadingClassName="page-loader"
    >
      <MarketplacePage>
        { children }
      </MarketplacePage>
    </AsyncComponent>
  );
});

const MarketplaceBrowser = observer(() => {
  let match = useRouteMatch();

  return (
    <div className="marketplace-browser content">
      <h1 className="page-header">Marketplace</h1>
      <div className="card-list">
        { Object.keys(rootStore.marketplaces).map((marketplaceId, index) => {
          const marketplace = rootStore.marketplaces[marketplaceId];

          if(!marketplace) { return null; }

          const imageUrl = rootStore.PublicLink({
            versionHash: marketplace.versionHash,
            path: UrlJoin("public", "asset_metadata", "info", "images", "image"),
            queryParams: { width: 400 }
          });

          return (
            <div className="card-container card-container-marketplace" key={`marketplace-${index}`}>
              <Link
                to={`${match.url}/${marketplaceId}/store`}
                className="card nft-card"
              >
                <ImageIcon
                  title={marketplace.name}
                  icon={imageUrl || NFTPlaceholderIcon}
                  alternateIcon={NFTPlaceholderIcon}
                  className="nft-image card__image"
                />
                <div className="card__text">
                  <h2 className="card__title">
                    { marketplace.name }
                  </h2>
                  <h2 className="card__subtitle">
                    { marketplace.description }
                  </h2>
                </div>
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
});

const MarketplaceRoutes = () => {
  let { path } = useRouteMatch();

  return (
    <div className="page-container marketplace-page">
      <Switch>
        <Route exact path={`${path}/:marketplaceId/events/:dropId`}>
          <MarketplaceWrapper>
            <Drop />
          </MarketplaceWrapper>
        </Route>

        <Route exact path={`${path}/:marketplaceId/events/:dropId/status`}>
          <DropMintingStatus />
        </Route>

        <Route exact path={`${path}/:marketplaceId/collections`}>
          <MarketplaceWrapper>
            <MarketplaceCollections />
          </MarketplaceWrapper>
        </Route>

        <Route exact path={`${path}/:marketplaceId/collections/:collectionIndex/owned/:contractId/:tokenId`}>
          <MarketplaceWrapper>
            <NFTDetails/>
          </MarketplaceWrapper>
        </Route>

        <Route exact path={`${path}/:marketplaceId/collections/:collectionIndex/owned/:contractId/:tokenId/open`}>
          <div className="content">
            <PackOpenStatus />
          </div>
        </Route>

        <Route exact path={`${path}/:marketplaceId/collections/:collectionIndex/store/:sku`}>
          <MarketplaceWrapper>
            <MarketplaceItemDetails />
          </MarketplaceWrapper>
        </Route>

        <Route exact path={`${path}/:marketplaceId/owned`}>
          <MarketplaceWrapper>
            <MarketplaceOwned />
          </MarketplaceWrapper>
        </Route>

        <Route exact path={`${path}/:marketplaceId/owned/:contractId/:tokenId`}>
          <MarketplaceWrapper>
            <NFTDetails/>
          </MarketplaceWrapper>
        </Route>

        <Route exact path={`${path}/:marketplaceId/owned/:contractId/:tokenId/open`}>
          <div className="content">
            <PackOpenStatus />
          </div>
        </Route>

        <Route exact path={`${path}/:marketplaceId/store`}>
          <MarketplaceWrapper>
            <Marketplace />
          </MarketplaceWrapper>
        </Route>

        <Route exact path={`${path}/:marketplaceId/store/:sku`}>
          <MarketplaceWrapper>
            <MarketplaceItemDetails />
          </MarketplaceWrapper>
        </Route>

        <Route exact path={`${path}/:marketplaceId/store/:sku/purchase/:confirmationId`}>
          <div className="content">
            <MarketplacePurchase />
          </div>
        </Route>

        <Route exact path={`${path}/:marketplaceId/store/:sku/purchase/:confirmationId/success`}>
          <div className="content">
            <MarketplacePurchase />
          </div>
        </Route>

        <Route exact path={`${path}/:marketplaceId/store/:sku/purchase/:confirmationId/cancel`}>
          <div className="content">
            <MarketplacePurchase />
          </div>
        </Route>

        <Route exact path={path}>
          <MarketplaceBrowser />
        </Route>
      </Switch>
    </div>
  );
};

export default MarketplaceRoutes;
