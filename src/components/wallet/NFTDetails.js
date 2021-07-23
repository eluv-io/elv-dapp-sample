import React from "react";
import {observer} from "mobx-react";
import {rootStore} from "Stores/index";

import {useRouteMatch} from "react-router-dom";
import {NFTImage} from "Components/common/Images";
import {ExpandableSection, CopyableField} from "Components/common/UIComponents";

const NFTDetails = observer(() => {
  const match = useRouteMatch();
  const nft = rootStore.NFT(match.params.tokenId);

  let mintDate = nft.metadata.created_at;
  if(mintDate) {
    try {
      const parsedMintDate = new Date(mintDate);
      if(!(parsedMintDate instanceof Date && !isNaN(parsedMintDate))) {
        rootStore.Log(`Invalid date: ${mintDate}`, true);
      } else {
        mintDate = `${parsedMintDate.getFullYear()}/${parsedMintDate.getMonth() + 1}/${parsedMintDate.getDate()}`;
      }
    } catch(error) {
      mintDate = "";
    }
  }

  return (
    <div className="nft-details">
      <div className="nft-details__content card-shadow">
        <h2 className="nft-details__content__header">
          { nft.metadata.display_name }
        </h2>
        <NFTImage nft={nft} video />
        <div className="nft-details__content__id ellipsis">
          { match.params.tokenId }
        </div>
      </div>

      <div className="nft-details__info">
        <ExpandableSection header="Description">
          { nft.metadata.description }
        </ExpandableSection>

        <ExpandableSection header="Contract">
          <CopyableField value={nft.details.ContractAddr}>
            Contract Address: { nft.details.ContractAddr }
          </CopyableField>
          <CopyableField value={nft.details.versionHash}>
            Hash: { nft.details.versionHash }
          </CopyableField>
          <div>
            <a
              className="lookout-url"
              target="_blank"
              href={`https://lookout.qluv.io/address/${nft.details.ContractAddr}/transactions`} rel="noopener"
            >
              See More Info on Eluvio Lookout
            </a>
          </div>
        </ExpandableSection>

        <ExpandableSection header="Details">
          {
            nft.metadata.embed_url ?
              <CopyableField value={nft.metadata.embed_url}>
                Media URL: { nft.metadata.embed_url }
              </CopyableField>
              : null
          }
          {
            nft.metadata.creator ?
              <div>
                Creator: { nft.metadata.creator }
              </div>
              : null
          }
          {
            nft.metadata.total_supply ?
              <div>
                Total Supply: { nft.metadata.total_supply }
              </div>
              : null
          }
          <br />
          <div>
            { nft.metadata.copyright }
          </div>
          <div>
            { mintDate ? `Minted on the Eluvio Content Fabric on ${mintDate}` : "" }
          </div>
        </ExpandableSection>
      </div>
    </div>
  );
});

export default NFTDetails;
