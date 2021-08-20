import React, {useState} from "react";

import {observer} from "mobx-react";
import {rootStore} from "Stores/index";
import SVG from "react-inlinesvg";
import UserIcon from "Assets/icons/user.svg";
import NFTPlaceholderIcon from "Assets/icons/nft";
import ImageIcon from "Components/common/ImageIcon";

export const ProfileImage = observer(({height=100, className=""}) => {
  const hasImage = rootStore.initialized && rootStore.profileMetadata.public.profile_image;
  return (
    <div className={`profile-image ${hasImage ? "profile-image-image" : "profile-image-placeholder"} ${className}`}>
      {
        hasImage ?
          <img className="profile-image__image" src={rootStore.ProfileLink({path: "public/profile_image", queryParams: {height}})} alt="Profile Image" /> :
          <SVG src={UserIcon} className="profile-image__placeholder" alt="Profile Image" />
      }
    </div>
  );
});

export const NFTImage = observer(({nft, width, video=false, className=""}) => {
  const [loaded, setLoaded] = useState(video && nft.metadata.embed_url || nft.metadata.image);

  let url = nft.metadata.image;

  if(url && width) {
    url = new URL(url);
    url.searchParams.set("width", width);
    url = url.toString();
  }

  if(video && nft.metadata.embed_url) {
    return (
      <div className={`nft-image nft-image-video-embed ${className}`}>
        <iframe
          className="nft-image-video-embed__frame"
          src={nft.metadata.embed_url}
          allowFullScreen
        />
      </div>
    );
  }
  return (
    nft.metadata.image ?
      <img
        onLoad={() => setLoaded(true)}
        src={url}
        className={`nft-image nft-image-image ${loaded ? "" : "nft-image-loading"} ${className}`}
        alt={nft.metadata.display_name}
      /> :
      <SVG
        src={NFTPlaceholderIcon}
        className={`nft-image nft-image-placeholder ${className}`}
        alt={nft.metadata.display_name}
      />
  );
});

export const MarketplaceImage = ({marketplaceHash, item, title, path, className=""}) => {
  let url;
  if(!item || item.image) {
    url = rootStore.PublicLink({
      versionHash: marketplaceHash,
      path,
      queryParams: { width: 800 }
    });
  } else if(item.nft_template) {
    url = (item.nft_template.nft || {}).image;
  } else {
    return <SVG src={NFTPlaceholderIcon} className="nft-image nft-image-placeholder" alt={item.name} />;
  }

  return (
    <ImageIcon
      title={title || item && item.name || ""}
      icon={url || NFTPlaceholderIcon}
      alternateIcon={NFTPlaceholderIcon}
      className={`nft-image card__image ${className}`}
    />
  );
};
