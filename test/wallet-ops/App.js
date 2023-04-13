import "../../src/static/stylesheets/reset.scss";
import "../test.scss";
import "../../src/static/stylesheets/loaders.scss";

import React, { useEffect, useState } from "react";
import { render } from "react-dom";
import { ElvWalletClient } from "@eluvio/elv-client-js/src/walletClient";
import { PageLoader } from "Components/common/Loaders";

import { EluvioLive } from "./EluvioLive.js";
import { MarketplaceLoader } from "./MarketplaceLoader.js";
import { CrossChainOracle } from "./CrossChainOracle.js";

// eluvio EvWalletClient mode -- "staging" or "production"
const mode = "staging";

// eluvio backend network configuration -- "main" or "demo"
const network = new URLSearchParams(window.location.search).get("network-name") || "main";

// marketplace configuration -- returns { tenantSlug:, marketplaceSlug: }
const marketplaceParams = MarketplaceLoader.parseMarketplaceParams();

// wallet app configuration
const walletAppUrl = network === "demo" ?
  "https://core.test.contentfabric.io/wallet-demo" :
  "https://core.test.contentfabric.io/wallet";


const AuthSection = ({walletClient}) => {
  const [loggedIn, setLoggedIn] = useState(walletClient.loggedIn);

  const LogIn = async ({method}) => {
    window.client = await walletClient.LogIn({
      method,
      callbackUrl: window.location.href,
      marketplaceParams,
      clearLogin: true
    });

    if(method !== "redirect") {
      setLoggedIn(true);
    }
  };

  const LogOut = async () => {
    await walletClient.LogOut();
    setLoggedIn(false);
  };

  if(!loggedIn) {
    return (
      <div className="auth-container">
        <button onClick={() => LogIn({method: "redirect"})}>
          Login
        </button>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-text" title={walletClient.UserInfo()?.email || walletClient.UserAddress()}>Logged In as { walletClient.UserInfo()?.email || walletClient.UserAddress() }</div>
      <button onClick={() => LogOut()}>
        Log Out
      </button>
    </div>
  );
};

const JsonSection = ({inputs, results, embed}) => {
  if(!(inputs || results || embed)) { return null; }

  return (
    <div className="json-container">
      {
        inputs &&
        <div className="json-section">
          <div className="preformat-header">Input</div>
          <pre>{stringify(inputs)}</pre>
        </div>
      }

      {
        results &&
        <div className="json-section">
          <div className="preformat-header">Output</div>
          <pre>{stringify(results)}</pre>
        </div>
      }

      {
        !!embed && embed
      }
    </div>
  );
};

const networkNumber = (networkName) => {
  return networkName == "main" ? "955305" : "955210";
};

const SetDefaults = () => {
  const defaults = {
    evmChain: networkNumber(network),
    evmNft: "0x43842733179fa1c38560a44f1d9067677461c8ca",
    flowNft: "0x329feb3ab062d289:CNN_NFT",
    solanaNft: "Ag3m1p1B6FMWKunTQwDW98fLEpcPaobmuthx1u9xLP9q",
    playoutToken: "",
    playoutVersionHash: ""
  };

  ["evmChain", "evmNft", "flowNft", "solanaNft", "playoutToken", "playoutVersionHash"].forEach(inputId => {
    const element = document.getElementById(inputId);
    if(element) { element.value = defaults[inputId]; }
  });
};

const stringify = (o) => { if(typeof o === "string") { return o; } else return JSON.stringify(o, null, 2); };

const App = () => {
  const [walletClient, setWalletClient] = useState(undefined);
  const [inputs, setInputs] = useState(undefined);
  const [results, setResults] = useState(undefined);
  const [embed, setEmbed] = useState(undefined);

  const getInput = (name) => { return document.getElementsByName(name)?.item(0)?.value || ""; };

  useEffect(() => {
    ElvWalletClient.Initialize({
      network,
      mode,
      //marketplaceParams
    })
      .then(client => {
        client.walletAppUrl = walletAppUrl;

        window.client = client;

        // Replace CanSign method to force popup flow for personal sign with custodial wallet user
        client.CanSign = () => client.loggedIn && client.UserInfo().walletName.toLowerCase() === "metamask";


        setWalletClient(client);
      });
  }, []);

  useEffect(() => {
    if(!walletClient) { return; }

    SetDefaults();
  }, [walletClient]);

  if(!walletClient) {
    return (
      <div className="app">
        <PageLoader />
      </div>
    );
  }

  const SignSolana = async () => {
    // input is a Mint address, not Token address
    const input = getInput("solanaNft") || "Ag3m1p1B6FMWKunTQwDW98fLEpcPaobmuthx1u9xLP9q";
    // alternative valid contract to test balance == 0: "7bRxdUMy7KoZAv4SXPBNTciWZGGATkSUczv1AjYqWnsT"

    setInputs({ "solana contract address": input });
    setResults("<operation pending>");
    if("phantom" in window) {
      const provider = window.phantom?.solana;
      if(provider?.isPhantom) {
        window.console.log("phantom.solana provider", provider);
        try {
          const resp = await provider.connect();
          window.console.log("publicKey:", resp.publicKey.toString());
          const xcMsg = {
            "chain_type": "solana",
            "chain_id": "4sGjMW1sUnHzSxGspuhpqLDx6wiyjNtZ",
            "asset_type": "NonFungibleToken",
            "asset_id": input,
            "method": "balance",
            "user": resp.publicKey.toString(),
          };

          const encodedMessage = new TextEncoder().encode(input);
          const signedMessage = await provider.request({
            method: "signMessage",
            params: {message: encodedMessage, display: "hex"},
          });
          window.console.log("provider.request({method=signMessage}):", signedMessage);

          // OPTIONAL: Signature validation. This overloads a user/signature pair into the user field (a workaround
          // until we pass the signature as part of the bearer auth header). To disable, comment out the line below.
          xcMsg.user = JSON.stringify(signedMessage);

          setInputs(xcMsg);
          const cco = await new CrossChainOracle(walletClient);
          window.console.log("cco:", cco);

          let res = await cco.Run("solana", xcMsg).catch(err => { return err; });
          setResults({rpcResult: res, policyFor: cco.item});

          UpdateAuthTokens(res);
        } catch(err) {
          // { code: 4001, message: 'User rejected the request.' }
          setResults(err);
        }
      } else {
        window.console.error("connect with phantom first");
        setResults("<connect with phantom first>");
      }
    }
  };

  const Playout = async () => {
    let playoutToken = getInput("playoutToken");
    let playoutVersionHash = getInput("playoutVersionHash");
    setInputs({playoutVersionHash: playoutVersionHash, playoutToken: playoutToken});
    setResults("");

    if(playoutVersionHash.startsWith("hq__")) {
      let embedUrl = `https://embed.v3.contentfabric.io//?net=${network}&p&ct=h&vid=${playoutVersionHash}&ath=${playoutToken}`;
      setEmbed(EmbedCode(embedUrl));
    } else {
      setResults("invalid version hash (expecting 'hq__...')");
    }
  };

  const EmbedCode = (embedUrl) => {
    let embedCode = `<iframe width=854 height=480
        scrolling="no" marginheight="0" marginwidth="0"
        frameborder="0" type="text/html"
        allow="encrypted-media"
        src="${embedUrl}" />`;
    return (
      <div className="embed-code-container">
        <div className="preformat-header">Embed Code</div>
        <pre className="embed-code">{ embedCode }</pre>
        <div className="preformat-header">Embed URL</div>
        <pre className="embed-code">{ embedUrl }</pre>
        <div className="preformat-header">Embedded Content (invisible if invalid)</div>
        <div className="embed"
          ref={element => {
            if(!element) { return; }
            element.innerHTML = embedCode;

            window.scrollTo({
              top: element.parentElement.getBoundingClientRect().top + (window.pageYOffset || element.parentElement.scrollTop),
              behavior: "smooth"
            });
          }}
        />
      </div>
    );
  };

  const ChangeNetwork = async (event) => {
    const url = new URL(window.location.href);
    url.search = "network-name=" + event.target.value;
    window.history.replaceState("", "", url.toString());
    window.location = url;
  };

  const LoadMarketplaces = async () => {
    await new MarketplaceLoader(walletClient, marketplaceParams).loadMarketplaces();
  };

  const CrossChainAuth = async (type, addr, chainId) => {
    window.console.log("CrossChainAuth:", type, addr, chainId);
    if(type == "eth" && !chainId) {
      window.console.log("set default eth network:", networkNumber(network));
      chainId = networkNumber(network);
    }

    const cco = await new CrossChainOracle(walletClient);
    const xcMsg = cco.GetXcoMessage(type, addr, "", chainId);

    setInputs(xcMsg);
    setResults("<operation pending>");
    setEmbed("");
    let res = await cco.Run(type, xcMsg).catch(err => { return err; });
    setResults({rpcResult: res, policyFor: cco.item});
    UpdateAuthTokens(res);
  };

  const UpdateAuthTokens = (res) => {
    window.console.log("UpdateAuthTokens:", res);
    const token = res?.msg?.token;
    for(const i of [1, 2, 3, 4, 5, 6]) {
      const iframe = document.getElementById("iframe" + i);
      const src = iframe.src;
      window.console.log("iframe" + i, iframe);
      let href = new URL(src);
      href.searchParams.set("ath", token);
      iframe.src = href.toString();
    }
  };

  // TODO: this is getting called too much: twice on start, and after method calls
  setTimeout(LoadMarketplaces, 1);

  return (
    <div className="page-container">
      <div className="top-bar">
        <h1>Cross-chain Authorization</h1>

        <div className="actions">
          <select value={network} onChange={ChangeNetwork}>
            <option value="main">Selected Network: main</option>
            <option value="demo">Selected Network: demo</option>
          </select>

          <AuthSection walletClient={walletClient} />
        </div>

        <div className="github-container"><a className="source-link" href="https://github.com/eluv-io/elv-dapp-sample/" target="_blank">
          <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="-elv-icon github-icon">
            <title>GitHub icon</title>
            <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"></path>
          </svg>Source available on GitHub
        </a></div>
      </div>

      {
        walletClient.loggedIn ?
          <>
            <div className="video-container">
              <div className="iframe-row">
                <div className="embed-frame">
                  <iframe id="iframe1" width="500" height="240" scrolling="no" marginHeight="0" marginWidth="0" frameBorder="0" type="text/html" allow="encrypted-media"
                    src="https://embed.v3.contentfabric.io/?net=demo&p&ct=h&vid=hq__8RBeZSEeZKGRucRNFDFN6Td3SgS71Yq2Lz5k4bf773HabL2B22DKxkxWGELPX2kEUQjgBG4wRc&pst=https://demov3.net955210.contentfabric.io/s/demov3/q/hq__8RBeZSEeZKGRucRNFDFN6Td3SgS71Yq2Lz5k4bf773HabL2B22DKxkxWGELPX2kEUQjgBG4wRc/meta/public/asset_metadata/images/hero/default&mt=v&nwm"/>
                  <label>Tears of Steel</label>
                  <label>ELV wallet</label>
                </div>
                <div className="embed-frame">
                  <iframe id="iframe2" width="500" height="240" scrolling="no" marginHeight="0" marginWidth="0" frameBorder="0" type="text/html" allow="encrypted-media"
                    src="https://embed.v3.contentfabric.io/?net=demo&p&ct=h&vid=hq__BJ4ury6zXvHv4tG4FndgqynDR15ejEwQyeN1sojDvygqtzsfNmpkZnWLvkyfRBHBKFQoCyS53s&pst=https://demov3.net955210.contentfabric.io/s/demov3/q/hq__BJ4ury6zXvHv4tG4FndgqynDR15ejEwQyeN1sojDvygqtzsfNmpkZnWLvkyfRBHBKFQoCyS53s/meta/public/asset_metadata/images/hero/default&mt=v&nwm="/>
                  <label>Meridian</label>
                  <label>Solana Wallet</label>
                </div>
                <div className="embed-frame">
                  <iframe id="iframe3" width="500" height="240" scrolling="no" marginHeight="0" marginWidth="0" frameBorder="0" type="text/html" allow="encrypted-media"
                    src="https://embed.v3.contentfabric.io/?net=demo&p&ct=h&vid=hq__FMoXffaXr5mochFba2MYpQMexQpgmy5tx61CxZRZBZ8K4XFrqcpy9hsLtWGAt5j4Ge8eN6cTGG&pst=https://demov3.net955210.contentfabric.io/s/demov3/q/hq__FMoXffaXr5mochFba2MYpQMexQpgmy5tx61CxZRZBZ8K4XFrqcpy9hsLtWGAt5j4Ge8eN6cTGG/meta/public/asset_metadata/images/hero/default&mt=v&nwm="/>
                  <label>Agent 327</label>
                  <label>Solana Wallet</label>
                </div>
              </div>
              <div className="iframe-row">
                <div className="embed-frame">
                  <iframe id="iframe4" width="500" height="240" scrolling="no" marginHeight="0" marginWidth="0" frameBorder="0" type="text/html" allow="encrypted-media"src="https://embed.v3.contentfabric.io/?net=demo&p&ct=h&vid=hq__9xS9V4VpFp9xN9rAQdjD3q1hTWGGz2RpCj9MBTSQaR1nuWrPjpCdxVe1onXTTtg921w8oQxnMK&pst=https://demov3.net955210.contentfabric.io/s/demov3/q/hq__9xS9V4VpFp9xN9rAQdjD3q1hTWGGz2RpCj9MBTSQaR1nuWrPjpCdxVe1onXTTtg921w8oQxnMK/meta/public/asset_metadata/images/hero/default&mt=v&nwm"/>
                  <label>Caminandes (Episode 1) </label>
                  <label>Flow wallet</label>
                </div>
                <div className="embed-frame">
                  <iframe id="iframe5" width="500" height="240" scrolling="no" marginHeight="0" marginWidth="0" frameBorder="0" type="text/html" allow="encrypted-media"
                    src="https://embed.v3.contentfabric.io/?net=demo&p&ct=h&vid=hq__2wgaPpzjcRUJsctv7YcjGdqyG6GnuEdtS2fwnFNprQFLCia7XywQ98E57aMNqckUcEgaiQHYwf&pst=https://demov3.net955210.contentfabric.io/s/demov3/q/hq__2wgaPpzjcRUJsctv7YcjGdqyG6GnuEdtS2fwnFNprQFLCia7XywQ98E57aMNqckUcEgaiQHYwf/meta/public/asset_metadata/images/hero/default&mt=v&nwm"/>
                  <label>Caminandes (Episode 2) </label>
                  <label>ETH mainnet wallet</label>
                </div>
                <div className="embed-frame">
                  <iframe id="iframe6" width="500" height="240" scrolling="no" marginHeight="0" marginWidth="0" frameBorder="0" type="text/html" allow="encrypted-media"
                    src="https://embed.v3.contentfabric.io/?net=demo&p&ct=h&vid=hq__E8fxNTi4Y4MMiEwY7rCt3wTnY8DWpuED2JQbZBNAcZrcqCjSNZ1frCEJ9kVSxXqJZswbCccR92&pst=https://demov3.net955210.contentfabric.io/s/demov3/q/hq__E8fxNTi4Y4MMiEwY7rCt3wTnY8DWpuED2JQbZBNAcZrcqCjSNZ1frCEJ9kVSxXqJZswbCccR92/meta/public/asset_metadata/images/hero/default&mt=v&nwm"/>
                  <label>Caminandes (Episode 3) </label>
                  <label>Polygon wallet</label>
                </div>
              </div>
            </div>
            <div className="main-content">
              <div className="main-sidebar-controls">
                <div className="form-item">
                  <label htmlFor="evmNft">EVM NFT chain ID:</label>
                  <input type="text" size="50" id="evmChain" name="evmChain" />
                  <button className="hidden-placeholder"></button>
                </div>
                <div className="form-item">
                  <label htmlFor="evmNft">EVM NFT contract address:</label>
                  <input type="text" size="50" id="evmNft" name="evmNft" />
                  <button onClick={async () =>
                    await CrossChainAuth("eth", getInput("evmNft"), getInput("evmChain"))}>Query EVM Cross-chain Oracle</button>
                </div>
                <br/>
                <div className="form-item">
                  <label htmlFor="flowNft">Flow NFT contract address:</label>
                  <input type="text" size="50" id="flowNft" name="flowNft" />
                  <button onClick={async () =>
                    await CrossChainAuth("flow", getInput("flowNft"), "mainnet")}>Query Flow Cross-chain Oracle</button>
                </div>
                <br/>
                <div className="form-item">
                  <label htmlFor="solanaNft">Solana NFT contract address:</label>
                  <input type="text" size="50" id="solanaNft" name="solanaNft" />
                  <button onClick={async () => await SignSolana()}>Query Solana Cross-chain Oracle</button>
                </div>
                <br/>
                <div className="form-item">
                  <label htmlFor="playoutToken">Gated content access token:</label>
                  <input type="text" size="50" id="playoutToken" name="playoutToken" />
                  <button className="hidden-placeholder"></button>
                </div>
                <div className="form-item">
                  <label htmlFor="playoutVersionHash">Gated content version hash:</label>
                  <input type="text" size="50" id="playoutVersionHash" name="playoutVersionHash" />
                  <button onClick={Playout}>Embed content</button>
                </div>
              </div>

              <div className="display-section">
                <JsonSection inputs={inputs} results={results} embed={embed} />
              </div>
            </div>
          </> : null
      }
    </div>
  );
};

render(<React.StrictMode><App /></React.StrictMode>, document.getElementById("app"));
