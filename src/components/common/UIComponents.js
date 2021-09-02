import React, {useState} from "react";
import SVG from "react-inlinesvg";

import CopyIcon from "Assets/icons/copy.svg";
import {Loader} from "Components/common/Loaders";

export const ExpandableSection = ({header, children, className=""}) => {
  const [ show, setShow ] = useState(false);

  return (
    <div className={`expandable-section card-shadow ${show ? "expandable-section-shown" : "expandable-section-hidden"} ${className}`}>
      <div className="expandable-section__header ellipsis" onClick={() => setShow(!show)}>
        { header }
      </div>
      { show ? <div className="expandable-section__content">{ children }</div> : null }
    </div>
  );
};

export const CopyableField = ({value, children, className=""}) => {
  const Copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch(error) {
      const input = document.createElement("input");

      input.value = value;
      input.select();
      input.setSelectionRange(0, 99999);
      document.execCommand("copy");
    }
  };

  return (
    <div className={`copyable-field ${className}`} onClick={Copy}>
      <div className="copyable-field__content ellipsis">
        { children }
      </div>
      <button className="copyable-field__button" title="Copy to Clipboard">
        <SVG src={CopyIcon} alt="Copy" />
      </button>
    </div>
  );
};

export const ItemPrice = (item, currency) => {
  currency = Object.keys(item.price || {}).find(c => c.toLowerCase() === currency.toLowerCase());

  if(!currency) {
    return "";
  }

  return parseFloat(item.price[currency]);
};

export const FormatPriceString = (priceList, options={currency: "USD", trimZeros: false}) => {
  const price = ItemPrice({price: priceList}, options.currency);

  if(!price || isNaN(price)) { return; }

  const currentLocale = (navigator.languages && navigator.languages.length) ? navigator.languages[0] : navigator.language;
  let formattedPrice = new Intl.NumberFormat(currentLocale || "en-US", { style: "currency", currency: options.currency }).format(price);

  if(options.trimZeros && formattedPrice.endsWith(".00")) {
    formattedPrice = formattedPrice.slice(0, -3);
  }

  return formattedPrice;
};

export const ButtonWithLoader = ({children, className="", onClick}) => {
  const [loading, setLoading] = useState(false);

  return (
    <div className={`button-container loader-button ${className}`}>
      {
        loading ?
          <Loader className="loader-button__loader"/> :
          <button
            className="button loader-button__button"
            onClick={async () => {
              try {
                setLoading(true);
                await onClick();
              } finally {
                setLoading(false);
              }
            }}
          >
            { children }
          </button>
      }
    </div>
  );
};
