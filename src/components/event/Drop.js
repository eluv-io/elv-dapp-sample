import React, {useState} from "react";
import {rootStore} from "Stores/index";
import AsyncComponent from "Components/common/AsyncComponent";
import {
  useRouteMatch
} from "react-router-dom";
import UrlJoin from "url-join";
import {MarketplaceImage} from "Components/common/Images";

const DropCard = ({marketplace, label, sku, selected=false, Select}) => {
  const itemIndex = marketplace.items.findIndex(item => item.sku === sku);

  if(itemIndex < 0) { return null; }

  const item = marketplace.items[itemIndex];

  return (
    <div className={`card-container card-shadow card-container-selectable ${selected ? "card-container-selected" : ""}`} onClick={Select}>
      <div className="card">
        <MarketplaceImage
          marketplaceHash={marketplace.versionHash}
          item={item}
          path={UrlJoin("public", "asset_metadata", "info", "items", itemIndex.toString(), "image")}
        />
        <div className="card__text">
          <h2 className="card__title">
            <div className="card__title__title">
              { label || item.name }
            </div>
          </h2>
          <h2 className="card__subtitle">
            { item.description }
          </h2>
        </div>
      </div>
    </div>
  );
};

const Drop = () => {
  const match = useRouteMatch();

  const [selection, setSelection] = useState(undefined);

  return (
    <AsyncComponent
      Load={async () => {
        await Promise.all([
          rootStore.LoadMarketplace(match.params.marketplaceId),
        ]);
      }}
      loadingClassName="page-loader"
      render={() => {
        const marketplace = rootStore.marketplaces[match.params.marketplaceId];
        const drop = marketplace.drops.find(drop => drop.uuid === match.params.dropId);

        if(!marketplace || !drop) { return null; }

        return (
          <div className="drop content">
            <h1 className="page-header">{ drop.drop_header }</h1>
            { drop.drop_subheader ? <h2 className="page-subheader">{ drop.drop_subheader }</h2> : null }
            <div className="card-list">
              {
                drop.nfts.map(({label, sku}, index) =>
                  <DropCard
                    key={`drop-card-${index}`}
                    marketplace={marketplace}
                    label={label}
                    sku={sku}
                    selected={selection === sku}
                    Select={() => setSelection(sku)}
                  />
                )
              }
            </div>
          </div>
        );
      }}
    />
  );
};

export default Drop;
