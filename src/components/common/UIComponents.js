import React, {useEffect, useRef, useState} from "react";
import SVG from "react-inlinesvg";
import {observer} from "mobx-react";
import {checkoutStore, rootStore} from "Stores";
import {Loader} from "Components/common/Loaders";
import ImageIcon from "Components/common/ImageIcon";
import {v4 as UUID} from "uuid";

import SelectIcon from "Assets/icons/select-icon.svg";
import USDIcon from "Assets/icons/crypto/USD icon.svg";
import USDCIcon from "Assets/icons/crypto/USDC-icon.svg";
import CopyIcon from "Assets/icons/copy.svg";

import PageBackIcon from "Assets/icons/pagination arrow back.svg";
import PageForwardIcon from "Assets/icons/pagination arrow forward.svg";
import {render} from "react-dom";
import ReactMarkdown from "react-markdown";
import SanitizeHTML from "sanitize-html";
import QRCode from "qrcode";

export const PageControls = observer(({paging, maxSpread=15, hideIfOnePage, SetPage, className=""}) => {
  if(!paging || paging.total === 0) { return null; }

  const perPage = paging.limit || 1;
  const currentPage = Math.floor(paging.start / perPage) + 1;
  const pages = Math.ceil(paging.total / perPage);

  let spread = maxSpread;
  if(rootStore.pageWidth < 600) {
    spread = Math.min(5, maxSpread);
  } else if(rootStore.pageWidth < 1200) {
    spread = Math.min(9, maxSpread);
  }

  let spreadStart = Math.max(1, currentPage - Math.floor(spread / 2));
  const spreadEnd = Math.min(pages + 1, spreadStart + spread);
  spreadStart = Math.max(1, spreadEnd - spread);

  if(hideIfOnePage && pages <= 1) {
    return null;
  }

  return (
    <div className={`page-controls ${className}`}>
      <button
        title="Previous Page"
        disabled={paging.start <= 0}
        onClick={() => SetPage(currentPage - 1)}
        className="page-controls__button page-controls__button--previous"
      >
        <ImageIcon icon={PageBackIcon} />
      </button>
      { spreadStart > 1 ? <div className="page-controls__ellipsis">...</div> : null }
      {
        [...new Array(Math.max(1, spreadEnd - spreadStart))].map((_, index) => {
          const page = spreadStart + index;
          return (
            <button
              key={`page-controls-${index}`}
              title={`Page ${page}`}
              disabled={page === currentPage}
              onClick={() => SetPage(page)}
              className={`page-controls__page ${page === currentPage ? "page-controls__page--current" : ""}`}
            >
              {page}
            </button>
          );
        })
      }
      { spreadEnd < pages ? <div className="page-controls__ellipsis">...</div> : null }
      <button
        title="Next Page"
        disabled={paging.total <= currentPage * perPage}
        onClick={() => SetPage(currentPage + 1)}
        className="page-controls__button page-controls__button--next"
      >
        <ImageIcon icon={PageForwardIcon} />
      </button>
    </div>
  );
});

export const ExpandableSection = ({header, icon, children, expanded=false, toggleable=true, className="", contentClassName="", additionalContent}) => {
  const [ show, setShow ] = useState(expanded);

  return (
    <div className={`expandable-section ${show ? "expandable-section-shown" : "expandable-section-hidden"} ${className}`}>
      <button className="expandable-section__header ellipsis" onClick={() => toggleable && setShow(!show)} tabIndex={0}>
        { icon ? <ImageIcon className="expandable-section__header__icon" icon={icon} title={header} /> : null}
        { header }
      </button>
      { show ? <div className={`expandable-section__content ${contentClassName}`}>{ children }</div> : null }
      { show && additionalContent || null }
    </div>
  );
};

export const Copy = async (value) => {
  try {
    value = (value || "").toString();

    await navigator.clipboard.writeText(value);
  } catch(error) {
    const input = document.createElement("input");

    input.value = value;
    input.select();
    input.setSelectionRange(0, 99999);
    document.execCommand("copy");
  }
};

export const CopyableField = ({value, children, className="", ellipsis=true}) => {
  return (
    <div className={`copyable-field ${className}`} onClick={() => Copy(value)}>
      <div className={`copyable-field__content ${ellipsis ? "ellipsis" : ""}`}>
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

export const FormatPriceString = (
  priceList,
  options= {
    currency: "USD",
    quantity: 1,
    trimZeros: false,
    includeCurrency: false,
    useCurrencyIcon: false,
    includeUSDCIcon: false,
    prependCurrency: false
  }
) => {
  const currency = options?.currency || "USD";

  if(typeof priceList !== "object") {
    priceList = { [checkoutStore.currency]: priceList };
  }

  let price = ItemPrice({price: priceList}, currency);

  if(typeof price !== "number" || isNaN(price)) { return; }

  price = price * (options.quantity || 1);

  const currentLocale = (navigator.languages && navigator.languages.length) ? navigator.languages[0] : navigator.language;
  let formattedPrice = new Intl.NumberFormat(currentLocale || "en-US", { style: "currency", currency: currency}).format(price);

  if(options.trimZeros && formattedPrice.endsWith(".00")) {
    formattedPrice = formattedPrice.slice(0, -3);
  }

  const usdcIcon = options.includeUSDCIcon ? <ImageIcon icon={USDCIcon} className="formatted-price__icon" /> : null;
  if(options?.includeCurrency) {
    if(options?.useCurrencyIcon) {
      formattedPrice = <div className="formatted-price__value">{ formattedPrice }</div>;
      const icon = <ImageIcon icon={USDIcon} className="formatted-price__icon" />;
      return (
        <div className="formatted-price">
          {
            options.prependCurrency ?
              <>{usdcIcon}{icon}{formattedPrice}</> :
              <>{formattedPrice}{usdcIcon}{icon}</>
          }
        </div>
      );
    } else {
      formattedPrice = (
        <div className="formatted-price__value">
          {
            options.prependCurrency ?
              `${currency} ${formattedPrice}` :
              `${formattedPrice} ${currency}`
          }
        </div>
      );

      return (
        <div className="formatted-price">
          {options?.includeUSDCIcon ? usdcIcon : null}{formattedPrice}
        </div>
      );
    }
  } else if(options.includeUSDCIcon) {
    formattedPrice = <div className="formatted-price__value">{ formattedPrice }</div>;

    return (
      <div className="formatted-price">
        {usdcIcon}{formattedPrice}
      </div>
    );
  } else {
    return formattedPrice;
  }
};

export const RichText = ({richText, className=""}) => {
  return (
    <div
      className={`rich-text ${className}`}
      ref={element => {
        if(!element) { return; }

        render(
          <ReactMarkdown linkTarget="_blank" allowDangerousHtml >
            { SanitizeHTML(richText) }
          </ReactMarkdown>,
          element
        );
      }}
    />
  );
};

export const ButtonWithLoader = ({children, className="", onClick, isLoading, ...props}) => {
  const [loading, setLoading] = useState(false);

  return (
    <button
      {...props}
      className={`action action-with-loader ${loading || isLoading ? "action-with-loader--loading": ""} ${className}`}
      onClick={async event => {
        if(loading) { return; }

        try {
          setLoading(true);
          await onClick(event);
        } finally {
          setLoading(false);
        }
      }}
    >
      { loading || isLoading ? <Loader loader="inline" className="action-with-loader__loader" /> : null }
      <div className="action-with-loader__content">
        { children }
      </div>
    </button>
  );
};

export const ButtonWithMenu = ({buttonProps, RenderMenu, className=""}) => {
  const ref = useRef();
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    const onClickOutside = event => {
      if(!ref.current || !ref.current.contains(event.target)) {
        setShowMenu(false);
      }
    };

    document.addEventListener("click", onClickOutside);

    return () => document.removeEventListener("click", onClickOutside);
  }, []);

  return (
    <div className={`menu-button ${showMenu ? "menu-button--active" : ""} ${className}`} ref={ref}>
      <button
        {...buttonProps}
        className={`menu-button__button ${buttonProps?.className || ""}`}
        onClick={() => {
          setShowMenu(!showMenu);

          if(buttonProps?.onClick) {
            buttonProps.onClick();
          }
        }}
      />
      {
        showMenu ?
          <div className="menu-button__menu">
            { RenderMenu(() => setShowMenu(false)) }
          </div> : null
      }
    </div>
  );
};

let debounceTimeout;
export const DebouncedInput = ({...props}) => {
  const [inputValue, setInputValue] = useState(props.value);

  useEffect(() => {
    setInputValue(props.value);
  }, [props.value]);

  let inputProps = {...props};
  delete inputProps.onImmediateChange;

  return (
    <input
      {...inputProps}
      className={`debounced-input ${props.className || ""}`}
      value={inputValue}
      onKeyDown={event => {
        if(event.key === "Enter") {
          clearTimeout(debounceTimeout);
          props.onChange(inputValue);
        }
      }}
      onChange={event => {
        clearTimeout(debounceTimeout);

        let value = event.target.value;
        setInputValue(value);
        debounceTimeout = setTimeout(() => props.onChange(value), props.timeout || 1000);

        if(props.onImmediateChange) {
          props.onImmediateChange(value);
        }
      }}
    />
  );
};

export const Select = ({label, value, options, placeholder, onChange, containerClassName="", buttonClassName="", menuClassName=""}) => {
  // If only labels are provided, convert to array format
  if(!Array.isArray(options[0])) {
    options = options.map(option => [option, option]);
  }

  let currentIndex = options.findIndex(option => option[0] === value);
  if(currentIndex < 0 && !placeholder) {
    currentIndex = 0;
  }

  const [idPrefix] = useState(UUID());
  const [showMenu, setShowMenu] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(currentIndex);
  const [filter, setFilter] = useState("");
  const [filterLastTyped, setFilterLastTyped] = useState(0);
  const [mouseIn, setMouseIn] = useState(false);

  const ref = useRef();

  useEffect(() => {
    const onClickOutside = event => {
      if(!ref.current || !ref.current.contains(event.target)) {
        setShowMenu(false);
      }
    };

    document.addEventListener("click", onClickOutside);

    return () => document.removeEventListener("click", onClickOutside);
  }, []);


  useEffect(() => {
    if(!showMenu || mouseIn) { return; }

    // Scroll to selected item for keyboard selection
    const selectedItem = document.getElementById(`styled-select-${idPrefix}-${selectedIndex}`);

    if(selectedItem ) {
      selectedItem.parentElement.scrollTop = selectedItem.offsetTop;
    }
  }, [selectedIndex, showMenu]);

  useEffect(() => {
    const optionIndex = options.findIndex(option => option[1].toLowerCase().startsWith(filter.toLowerCase()));

    if(optionIndex >= 0) {
      setSelectedIndex(optionIndex);
    }
  }, [filter]);

  const KeyboardControls = event => {
    if(!showMenu) { return; }

    event.preventDefault();

    setMouseIn(false);
    switch(event.key) {
      case "Escape":
        setShowMenu(false);
        break;
      case "ArrowDown":
        setSelectedIndex(Math.min(selectedIndex + 1, options.length - 1));
        break;
      case "ArrowUp":
        setSelectedIndex(Math.max(selectedIndex - 1, 0));
        break;
      case "Home":
        setSelectedIndex(0);
        break;
      case "End":
        setSelectedIndex(options.length - 1);
        break;
      case "Enter":
        onChange(options[selectedIndex][0]);
        setShowMenu(false);
        break;
      case "Backspace":
        setFilter(filter.slice(0, filter.length - 1));
        break;
      default:
        if(event.key.length === 1 || event.key === "Space") {
          if(Date.now() - filterLastTyped < 2000) {
            setFilter(filter + event.key);
          } else {
            setFilter(event.key);
          }

          setFilterLastTyped(Date.now());
        }
    }
  };

  let menu;
  if(showMenu) {
    menu = (
      <ul
        aria-expanded={true}
        role="listbox"
        aria-labelledby={`styled-select-${idPrefix}-button`}
        tabIndex="-1"
        className={`styled-select__menu ${menuClassName}`}
        onMouseEnter={() => setMouseIn(true)}
        onMouseLeave={() => setMouseIn(false)}
      >
        {
          options.map((option, index) =>
            <li
              onClick={() => onChange(option[0])}
              onMouseEnter={() => {
                setMouseIn(true);
                setSelectedIndex(index);
              }}
              role="option"
              data-value={option[0]}
              aria-selected={value === option[0]}
              className={`styled-select__menu__option ${index === selectedIndex ? "styled-select__menu__option--selected" : ""}`}
              id={`styled-select-${idPrefix}-${index}`}
              key={`option-${index}`}
            >
              { option[1] }
            </li>
          )
        }
      </ul>
    );
  }

  return (
    <div className={`styled-select ${containerClassName}`}>
      <button
        id={`styled-select-${idPrefix}-button`}
        className={`styled-select__button ${showMenu ? "styled-select__button--active" : ""} ${buttonClassName}`}
        ref={ref}
        disabled={options.length === 0}
        aria-haspopup="listbox"
        aria-label={label}
        aria-activedescendant={showMenu ? `styled-select-${idPrefix}-${selectedIndex}` : ""}
        onClick={() => {
          if(!showMenu) {
            setSelectedIndex(currentIndex);
          }

          setShowMenu(!showMenu);
        }}
        onKeyDown={KeyboardControls}
      >
        { currentIndex < 0 ? placeholder : options[currentIndex || 0][1] }
        <div className="styled-select__button__icon-container">
          <ImageIcon icon={SelectIcon} className="styled-select__button__icon" />
        </div>
      </button>
      { menu }
    </div>
  );
};

export const QRCodeElement = ({content}) => {
  let options = { errorCorrectionLevel: "M", margin: 1 };

  if(rootStore.pageWidth < 600) {
    options.width = rootStore.pageWidth - 100;
  }

  return (
    <div className="qr-code">
      <canvas
        ref={element => {
          if(!element) { return; }

          QRCode.toCanvas(
            element,
            JSON.stringify(content),
            options,
            error => error && rootStore.Log(error, true)
          );
        }}
        className="qr-code__canvas"
      />
    </div>
  );
};

