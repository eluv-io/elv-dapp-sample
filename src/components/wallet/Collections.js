import React from "react";
import {observer} from "mobx-react";

import {rootStore, transferStore} from "Stores/index";
import UrlJoin from "url-join";
import LinesEllipsis from "react-lines-ellipsis";
import responsiveHOC from "react-lines-ellipsis/lib/responsiveHOC";
const ResponsiveEllipsis = responsiveHOC()(LinesEllipsis);
import {Link, useRouteMatch} from "react-router-dom";
import {NFTImage} from "Components/common/Images";
import ImageIcon from "Components/common/ImageIcon";

import ListingIcon from "Assets/icons/listing.svg";

export const NFTCard = observer(({nft}) => {
  const match = useRouteMatch();

  // Determine if this NFT is currently listed for sale
  const listing = transferStore.TransferListings({userAddress: rootStore.userAddress})
    .find(listing =>
      listing.details.ContractAddr === nft.details.ContractAddr &&
      listing.details.TokenIdStr === nft.details.TokenIdStr
    );

  return (
    <div className="card-container card-shadow">
      <Link
        to={UrlJoin(match.url, nft.details.ContractId, nft.details.TokenIdStr)}
        className="card nft-card"
      >
        <NFTImage nft={nft} width={400} />
        <div className="card__badges">
          { listing ?
            <ImageIcon icon={ListingIcon} title="This NFT is listed for sale" alt="Listing Icon" className="card__badge" />
            : null
          }
        </div>
        <div className="card__text">
          <div className="card__titles">
            <h2 className="card__title">
              { nft.metadata.display_name || "" }
            </h2>
            {
              nft.metadata.edition_name ?
                <h2 className="card__title-edition">
                  { nft.metadata.edition_name }
                </h2> : null
            }
            <div className="card__title-edition">
              { typeof nft.details.TokenOrdinal !== "undefined" ? `${parseInt(nft.details.TokenOrdinal)} / ${nft.details.Cap}` : nft.details.TokenIdStr }
            </div>
            <ResponsiveEllipsis
              component="h2"
              className="card__subtitle"
              text={nft.metadata.description}
              maxLine="3"
            />
          </div>
        </div>
      </Link>
    </div>
  );
});

const Collections = observer(() => {
  return (
    <div className="card-list collections">
      { rootStore.nfts.map(nft => <NFTCard nft={nft} key={`nft-card-${nft.details.ContractId}-${nft.details.TokenIdStr}`} />) }
    </div>
  );
});

export default Collections;
