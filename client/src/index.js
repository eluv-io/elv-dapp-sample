const EVENTS = require("./Events");

// https://stackoverflow.com/questions/4068373/center-a-popup-window-on-screen
const Popup = ({url, title, w, h}) => {
  // Fixes dual-screen position
  const dualScreenLeft = window.screenLeft || window.screenX;
  const dualScreenTop = window.screenTop || window.screenY;

  const width = window.innerWidth || document.documentElement.clientWidth || screen.width;
  const height = window.innerHeight || document.documentElement.clientHeight || screen.height;

  const systemZoom = width / window.screen.availWidth;
  const left = (width - w) / 2 / systemZoom + dualScreenLeft;
  const top = (height - h) / 2 / systemZoom + dualScreenTop;
  const newWindow = window.open(url, title,
    `
      scrollbars=yes,
      width=${w / systemZoom},
      height=${h / systemZoom},
      top=${top},
      left=${left}
    `
  );

  if(window.focus) newWindow.focus();

  return newWindow;
};

let __id = 0;
class Id {
  static next(){
    __id++;
    return __id;
  }
}

const SandboxPermissions = () => {
  return [
    "allow-downloads",
    "allow-scripts",
    "allow-forms",
    "allow-modals",
    "allow-pointer-lock",
    "allow-orientation-lock",
    "allow-popups",
    "allow-popups-to-escape-sandbox",
    "allow-presentation",
    "allow-same-origin",
    "allow-downloads-without-user-activation",
    "allow-storage-access-by-user-activation"
  ].join(" ");
};

const LOG_LEVELS = {
  DEBUG: 0,
  WARN: 1,
  ERROR: 2
};

/**
 * This page contains documentation for client setup, navigation and other management.
 <br /><br />
 * <a href="./module-ElvWalletClient_Methods.html">For details on retrieving information from and performing actions in the wallet, see the wallet client methods page.</a>
 */
class ElvWalletClient {
  Throw(error) {
    throw new Error(`Eluvio Media Wallet Client | ${error}`);
  }

  Log({message, level=this.LOG_LEVELS.WARN}) {
    if(level < this.logLevel) { return; }

    if(typeof message === "string") {
      message = `Eluvio Media Wallet Client | ${message}`;
    }

    switch(level) {
      case this.LOG_LEVELS.DEBUG:
        // eslint-disable-next-line no-console
        console.log(message);
        return;
      case this.LOG_LEVELS.WARN:
        // eslint-disable-next-line no-console
        console.warn(message);
        return;
      case this.LOG_LEVELS.ERROR:
        // eslint-disable-next-line no-console
        console.error(message);
        return;
    }
  }

  Destroy() {
    window.removeEventListener("message", this.EventHandler);

    if(this.Close) {
      this.Close();
    }
  }

  /**
   * This constructor should not be used. Please use <a href="#.InitializePopup">InitializeFrame</a> or <a href="#.InitializePopup">InitializePopup</a> instead.
   *
<pre><code>
import { ElvWalletClient } from "@eluvio/elv-wallet-client";

// Initialize in iframe at target element
const walletClient = await ElvWalletClient.InitializeFrame({
 walletAppUrl: "https://wallet.contentfabric.io",
 target: document.getElementById("#wallet-target"),
 marketplaceHash: <version-hash-of-marketplace>
});

// Or initialize in a popup
const walletClient = await ElvWalletClient.InitializePopup({
 walletAppUrl: "https://wallet.contentfabric.io",
});
</code></pre>
   * @constructor
   */
  constructor({
    walletAppUrl="http://wallet.contentfabric.io",
    target,
    Close,
    timeout=10
  }) {
    if(!walletAppUrl) {
      this.Throw("walletAppUrl not specified");
    }

    if(!target) {
      this.Throw("target not specified");
    }

    this.walletAppUrl = walletAppUrl;
    this.target = target;
    this.Close = Close;
    this.timeout = timeout;
    this.LOG_LEVELS = LOG_LEVELS;
    this.logLevel = this.LOG_LEVELS.WARN;
    this.EVENTS = EVENTS;

    this.eventListeners = {};
    Object.keys(EVENTS).forEach(key => this.eventListeners[key] = []);

    this.EventHandler = this.EventHandler.bind(this);

    window.addEventListener("message", this.EventHandler);

    // Ensure client is destroyed when target window closes
    this.AddEventListener(this.EVENTS.CLOSE, () => this.Destroy());
  }

  EventHandler(event) {
    const message = event.data;

    if(message.type !== "ElvMediaWalletEvent" || !EVENTS[message.event]) { return; }

    const listeners = message.event === EVENTS.ALL ?
      this.eventListeners[EVENTS.ALL] :
      [...this.eventListeners[message.event], ...this.eventListeners[EVENTS.ALL]];

    listeners.forEach(async Listener => {
      try {
        await Listener(message);
      } catch(error) {
        this.Log({
          message: `${message.event} listener error:`,
          level: this.LOG_LEVELS.WARN
        });
        this.Log({
          message: error,
          level: this.LOG_LEVELS.WARN
        });
      }
    });
  }


  /**
   * Event keys that can be registered in AddEventListener.
   *
   * Available options: LOADED, LOG_IN, LOG_OUT, CLOSE, ALL
   *
   * Also accessible as a property via `walletClient.EVENTS`
   *
   * @methodGroup Events
   */
  Events() {
    return this.EVENTS;
  }

  /**
   * Add an event listener for the specified event
   *
   * Example:
   *
   * `walletClient.AddEventListener(walletClient.EVENTS.LOG_IN, HandleLogin);`
   *
   * @methodGroup Events
   * @param {string} event - An event key from <a href="#Events">Events</a>
   * @param {function} Listener - An event listener
   */
  AddEventListener(event, Listener) {
    if(!EVENTS[event]) { this.Throw(`AddEventListener: Invalid event ${event}`); }
    if(typeof Listener !== "function") { this.Throw("AddEventListener: Listener is not a function"); }

    this.eventListeners[event].push(Listener);
  }

  /**
   * Remove the specified event listener
   *
   * @methodGroup Events
   * @param {string} event - An event key from <a href="#Events">Events</a>
   * @param {function} Listener - The listener to remove
   */
  RemoveEventListener(event, Listener) {
    if(!EVENTS[event]) { this.Throw(`RemoveEventListener: Invalid event ${event}`); }
    if(typeof Listener !== "function") { this.Throw("RemoveEventListener: Listener is not a function"); }

    this.eventListeners[event] = this.eventListeners[event].filter(f => f !== Listener);
  }


  /**
   * Request the wallet app navigate to the specified page.
   *
   * When specifying a marketplace, you must either provide:
   * - tenantSlug and marketplaceSlug - Slugs for the tenant and marketplace
   * - marketplaceHash - Version hash of a marketplace
   * - marketplaceId - Object ID of a marketplace
   *
   * Currently supported pages:
   - 'login' - The login page
   - 'wallet' - The user's global wallet
   - 'items' - List of items in the user's wallet
   - 'item' - A specific item in the user's wallet
   -- Required param: `contractAddress` or `contractId`
   -- Required param: `tokenId`
   - 'profile' - The user's profile
   - 'marketplaces'
   - 'marketplace':
   -- Required param: marketplace parameters
   - 'marketplaceItem`
   -- Required params: `sku`, marketplace parameters
   - 'marketplaceWallet' - The user's collection for the specified marketplace
   -- Required params: marketplace parameters
   - `drop`
   -- Required params: `tenantSlug`, `eventSlug`, `dropId`, marketplace parameters
   - `listings`
   - `marketplaceListings`
   -- Required params: marketplace parameters

   * @methodGroup Navigation
   * @namedParams
   * @param {string=} page - A named app path
   * @param {Object=} params - URL parameters for the specified path, e.g. { tokenId: <token-id> } for an 'item' page.
   * @param {string=} path - An absolute app path
   * @param {boolean=} loginRequired - If login was specified, this parameter will control whether the login prompt is dismissable
   * @param {Array<string>=} marketplaceFilters - A list of filters to limit items shown in the marketplace store page
   *
   * @returns {string} - Returns the actual route to which the app has navigated
   */
  async Navigate({page, path, loginRequired, params, marketplaceFilters=[]}) {
    return this.SendMessage({
      action: "navigate",
      params: {
        page,
        path,
        params,
        loginRequired,
        marketplaceFilters
      }
    });
  }

  /**
   * Retrieve the current location path of the wallet app
   *
   * @methodGroup Navigation
   * @returns {string} - The current path of the wallet app
   */
  async CurrentPath() {
    return this.SendMessage({
      action: "currentPath"
    });
  }


  /**
   * Request the navigation header and footer to be shown or hidden in the wallet
   *
   * @methodGroup Navigation
   * @namedParams
   * @param {boolean=} enabled=true - True to show navigation, false to hide it
   */
  async ToggleNavigation(enabled=true) {
    return this.SendMessage({
      action: "toggleNavigation",
      params: {
        enabled
      },
      noResponse: true
    });
  }

  /**
   * Set whether the wallet should be displayed in dark mode
   *
   * @methodGroup Navigation
   * @namedParams
   * @param {boolean=} enabled=true - True to enable dark mode, false to disable
   */
  async ToggleDarkMode(enabled=true) {
    return this.SendMessage({
      action: "toggleDarkMode",
      params: {
        enabled
      },
      noResponse: true
    });
  }

  /**
   * Request the wallet enter/exit 'side panel' mode, where certain elements are hidden
   *
   * @methodGroup Navigation
   * @namedParams
   * @param {boolean=} enabled=true - Whether side panel mode should be enabled
   */
  async ToggleSidePanelMode(enabled=true) {
    return this.SendMessage({
      action: "toggleSidePanelMode",
      params: {
        enabled
      },
      noResponse: true
    });
  }

  /**
   * Sign the user in to the wallet app. Authorization can be provided in three ways:
   <ul>
    <li>- ID token from an OAuth flow</li>
    <li>- Eluvio authorization token previously retrieved from exchanging an ID token</li>
    <li>- Private key of the user</li>
   <br/>
   *
   * NOTE: This is only to be used if authorization is performed outside of the wallet app. To direct the
   * wallet application to the login page, use the <a href="#Navigate">Navigate</a> method
   *
   * @methodGroup Authorization
   * @namedParams
   * @param {string} name - The name of the user
   * @param {string} email - The email address of the user
   * @param {string=} idToken - An OAuth ID token to authenticate with
   * @param {string=} authToken - An Eluvio authorization token
   * @param {string=} privateKey - The private key of the user
   */
  async SignIn({name, email, idToken, authToken, privateKey}) {
    return this.SendMessage({
      action: "login",
      params: {
        idToken,
        authToken,
        privateKey,
        user: {
          name,
          email
        }
      }
    });
  }

  /**
   * Sign the current user out
   *
   * @methodGroup Authorization
   */
  async SignOut() {
    return this.SendMessage({
      action: "logout",
      params: {}
    });
  }

  /**
   * Initialize the media wallet in a new window.
   *
   * @methodGroup Constructor
   *
   * @namedParams
   * @param {string=} walletAppUrl=http://wallet.contentfabric.io - The URL of the Eluvio Media Wallet app
   * @param {string=} tenantSlug - Specify the URL slug of your tenant. Required if specifying marketplaceSlug
   * @param {string=} marketplaceSlug - Specify the URL slug of your marketplace
   * @param {string=} marketplaceHash - Specify a specific version of a your marketplace. Not necessary if marketplaceSlug is specified
   * @param {boolean=} requireLogin=false - If specified, users will be required to log in before accessing any page in the app
   * @param {boolean=} captureLogin=false - If specified, the parent frame will be responsible for handling login requests. When the user attempts to log in, the LOG_IN_REQUESTED event will be fired.
   * @param {boolean=} darkMode=false - Specify whether the app should be in dark mode
   *
   * @return {Promise<ElvWalletClient>} - The ElvWalletClient initialized to communicate with the media wallet app in the new window.
   */
  static async InitializePopup({
    walletAppUrl="http://wallet.contentfabric.io",
    tenantSlug,
    marketplaceSlug,
    marketplaceId,
    marketplaceHash,
    requireLogin=false,
    captureLogin=false,
    darkMode=false
  }) {
    walletAppUrl = new URL(walletAppUrl);

    if(marketplaceSlug) {
      walletAppUrl.searchParams.set("mid", `${tenantSlug}/${marketplaceSlug}`);
    } else if(marketplaceId || marketplaceHash) {
      walletAppUrl.searchParams.set("mid", marketplaceHash || marketplaceId);
    }

    if(requireLogin){
      walletAppUrl.searchParams.set("rl", "");
    }

    if(captureLogin) {
      walletAppUrl.searchParams.set("cl", "");
    }

    if(!darkMode) {
      walletAppUrl.searchParams.set("lt", "");
    }

    const target = Popup({url: walletAppUrl.toString(), title: "Eluvio Media Wallet", w: 400, h: 700});

    const client = new ElvWalletClient({walletAppUrl: walletAppUrl.toString(), target, Close: () => target.close()});

    // Ensure app is initialized
    await client.AwaitMessage("init");

    return client;
  }

  /**
   * Initialize the media wallet in a new iframe. The target can be an existing iframe or an element in which to create the iframe,
   * and the target can be passed in either as an element directly, or by element ID.
   *
   * @methodGroup Constructor
   *
   * @namedParams
   * @param {string=} walletAppUrl=http://wallet.contentfabric.io - The URL of the Eluvio Media Wallet app
   * @param {Object | string} target - An HTML element or the ID of an element
   * @param {string=} tenantSlug - Specify the URL slug of your tenant. Required if specifying marketplace slug
   * @param {string=} marketplaceSlug - Specify the URL slug of your marketplace
   * @param {string=} marketplaceHash - Specify a specific version of a your marketplace. Not necessary if marketplaceSlug is specified
   * @param {boolean=} requireLogin=false - If specified, users will be required to log in before accessing any page in the app
   * @param {boolean=} captureLogin - If specified, the parent frame will be responsible for handling login requests. When the user attempts to log in, the LOG_IN_REQUESTED event will be fired.
   * @param {boolean=} darkMode=false - Specify whether the app should be in dark mode
   *
   * @return {Promise<ElvWalletClient>} - The ElvWalletClient initialized to communicate with the media wallet app in the new iframe.
   */
  static async InitializeFrame({
    walletAppUrl="http://wallet.contentfabric.io",
    target,
    tenantSlug,
    marketplaceSlug,
    marketplaceId,
    marketplaceHash,
    requireLogin=false,
    captureLogin=false,
    darkMode=false
  }) {
    if(typeof target === "string") {
      const targetElement = document.getElementById(target);

      if(!targetElement) {
        throw Error(`Eluvio Media Wallet Client: Unable to find element with target ID ${target}`);
      }

      target = targetElement;
    }

    if((target.tagName || target.nodeName).toLowerCase() !== "iframe") {
      let parent = target;
      parent.innerHTML = "";

      target = document.createElement("iframe");
      parent.appendChild(target);
    }

    target.classList.add("-elv-media-wallet-frame");
    target.sandbox = SandboxPermissions();
    target.setAttribute("allowFullScreen", "");
    target.allow = "encrypted-media *; clipboard-read; clipboard-write";

    walletAppUrl = new URL(walletAppUrl);

    if(marketplaceSlug) {
      walletAppUrl.searchParams.set("mid", `${tenantSlug}/${marketplaceSlug}`);
    } else if(marketplaceId || marketplaceHash) {
      walletAppUrl.searchParams.set("mid", marketplaceHash || marketplaceId);
    }

    if(requireLogin){
      walletAppUrl.searchParams.set("rl", "");
    }

    if(captureLogin) {
      walletAppUrl.searchParams.set("cl", "");
    }

    if(!darkMode) {
      walletAppUrl.searchParams.set("lt", "");
    }

    const client = new ElvWalletClient({
      walletAppUrl: walletAppUrl.toString(),
      target: target.contentWindow,
      Close: () => target && target.parentNode && target.parentNode.removeChild(target)
    });

    // Ensure app is initialized
    target.src = walletAppUrl.toString();
    await client.AwaitMessage("init");

    return client;
  }

  async SendMessage({action, params, noResponse=false}) {
    const requestId = `action-${Id.next()}`;

    this.target.postMessage({
      type: "ElvMediaWalletClientRequest",
      requestId,
      action,
      params
    }, this.walletAppUrl);

    if(noResponse) { return; }

    return (await this.AwaitMessage(requestId));
  }

  async AwaitMessage(requestId) {
    const timeout = this.timeout;
    return await new Promise((resolve, reject) => {
      let methodListener;

      // Initialize or reset timeout
      let timeoutId;
      const touchTimeout = () => {
        if(timeoutId) {
          clearTimeout(timeoutId);
        }

        if(timeout > 0) {
          timeoutId = setTimeout(() => {
            if(typeof window !== "undefined") {
              window.removeEventListener("message", methodListener);
            }

            reject(`Request ${requestId} timed out`);
          }, timeout * 1000);
        }
      };

      methodListener = async (event) => {
        try {
          const message = event.data;

          if(message.type !== "ElvMediaWalletResponse" || message.requestId !== requestId) {
            return;
          }

          clearTimeout(timeoutId);

          window.removeEventListener("message", methodListener);

          if(message.error) {
            reject(message.error);
          } else {
            resolve(message.response);
          }
        } catch(error){
          clearTimeout(timeoutId);

          window.removeEventListener("message", methodListener);

          reject(error);
        }
      };

      // Start the timeout
      touchTimeout();

      window.addEventListener("message", methodListener);
    });
  }
}

/**
 * `client.EVENTS` contains event keys for the AddEventListener and RemoveEventListener methods
 *
 * - `client.EVENTS.LOG_IN` - User has logged in. Event data contains user address.
 * - `client.EVENTS.LOG_OUT` - User has logged out. Event data contains user address.
 * - `client.EVENTS.CLOSE` - Target window or frame has been closed or has otherwise unloaded the wallet app.
 * - `client.EVENTS.ALL` - Any of the above events has occurred.
 */
ElvWalletClient.EVENTS = EVENTS;
ElvWalletClient.LOG_LEVELS = LOG_LEVELS;

Object.assign(ElvWalletClient.prototype, require("./ClientMethods"));

exports.ElvWalletClient = ElvWalletClient;
