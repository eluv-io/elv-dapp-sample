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
const network = new URLSearchParams(window.location.search).get("network-name") || "demo";

// marketplace configuration -- returns { tenantSlug:, marketplaceSlug: }
const marketplaceParams = MarketplaceLoader.parseMarketplaceParams();

// wallet app configuration
const walletAppUrl = network === "demo" ?
  "https://core.test.contentfabric.io/wallet-demo" :
  "https://core.test.contentfabric.io/wallet";


const AuthSection = ({walletClient}) => {
  const [loggedIn, setLoggedIn] = useState(walletClient.loggedIn);

  const LogIn = async ({method}) => {
    await walletClient.LogIn({
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
      <div className="section">
        <div className="button-row">
          <button onClick={() => LogIn({method: "redirect"})}>
            Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="section">
        <h2>Logged In as { walletClient.UserInfo()?.email || walletClient.UserAddress() }</h2>
        <div className="button-row">
          <button onClick={() => LogOut()}>
            Log Out
          </button>
        </div>
      </div>
      <br />
    </>
  );
};

const App = () => {
  const [walletClient, setWalletClient] = useState(undefined);
  const [inputs, setInputs] = useState(undefined);
  const [results, setResults] = useState(undefined);
  const [embed, setEmbed] = useState(undefined);
  const [pushService, setPushService] = useState(undefined);

  const clearAndShow = (results) => { setInputs(""); setEmbed(""); setResults(results); };
  const stringify = (o) => { if(typeof o === "string") { return o; } else return JSON.stringify(o, null, 2); };
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

  if(!walletClient) {
    return (
      <div className="app">
        <PageLoader />
      </div>
    );
  }

  const Sign = async () => {
    let msgToSign = getInput("signMsg");
    setInputs({ messageToSign: msgToSign});
    let res = await walletClient.PersonalSign({message: msgToSign})
      .catch(err => { return err; });
    setResults(res);
  };

  const SignSolana = async () => {
    const input = getInput("solanaNft") || "9eRpYSud54nfh3igq5CXw23FFtXaKQnfXiP2n6h8tMFM";
    setInputs({ "solana contract address": input });
    setResults("<operation pending>");
    // https://docs.phantom.app/solana/integrating-phantom/extension-and-in-app-browser-web-apps/signing-a-message
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
          const encodedMessage = new TextEncoder().encode(xcMsg);
          //const sm = await provider.signMessage(encodedMessage, "utf8");
          //window.console.log("signMessage():", new String(sm.publicKey), sm.signature);
          const signedMessage = await provider.request({
            method: "signMessage",
            params: {message: encodedMessage, display: "hex"},
          });
          window.console.log("provider.request({method=signMessage}):", signedMessage);

          // XXX include all the info into the user field just for testing
          xcMsg.user = JSON.stringify(signedMessage);
          setInputs(xcMsg);

          const cco = await new CrossChainOracle(walletClient);
          window.console.log("cco:", cco);
          let res = await cco.Run("solana", xcMsg).catch(err => { setResults(err); });
          setResults({rpcResult: res, policyFor: provider.item});
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

  // PushService SSE testing
  const StartListening = async () => {
    let count = 0;
    const signature = await walletClient.client.CreateFabricToken({duration: 1000 * 30}).catch(err => { return err; });
    // url for local testing
    //const url = "http://localhost:3030/register/" +
    const url = "https://appsvc.svc.eluv.io/push/dv3/register/" +
      walletClient.UserAddress() + "/" + signature;
    const source = new EventSource(url);
    window.console.log("url:", source.url, "withCreds:", source.withCredentials, "ready:", source.readyState);

    source.onmessage = (event) => {
      window.console.log("OnMessage Called[", count, "]:", event, JSON.parse(event.data));
      count++;
    };
    source.onopen = function() { window.console.log("Connection to server opened."); };
    source.onerror = (event) => { window.console.log("OnError Called:", event); };

    setPushService(source);
  };

  const StopListening = async () => {
    window.console.log("StopListening:", pushService);
    pushService.close();
  };

  const CheckNft = async () => {
    const inputs = { addr: getInput("nftAddressToVerify"), ownerAddr: getInput("nftOwnerToVerify")};
    setInputs(inputs);

    let ownedOrError = await new EluvioLive(walletClient).NftBalanceOf(inputs)
      .then(balance => {
        return (typeof balance === "number") ? { isOwned: balance > 0, balance: balance } : { err: balance };
      })
      .catch(err => { return { error: err.toString()}; });

    if (ownedOrError?.error) {
      setResults(ownedOrError);
    } else {
      let nftStats = await walletClient.NFTContractStats({contractAddress: inputs.addr})
        .catch(err => { return err; });
      setResults({ ownership: ownedOrError, nftStats: nftStats });
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

  const ChangeMarketplace = async (event) => {
    await new MarketplaceLoader(walletClient, marketplaceParams).setMarketplace(event);
  };

  const CrossChainAuth = async (type, addr) => {
    const cco = await new CrossChainOracle(walletClient);
    const xcMsg = cco.GetXcoMessage(type, addr, "", networkNumber(network));

    setInputs(xcMsg);
    setResults("<operation pending>");
    setEmbed("");
    let res = await cco.Run(type, xcMsg).catch(err => { return err; });
    setResults({rpcResult: res, policyFor: cco.item});
  };

  const networkNumber = (networkName) => {
    return networkName == "main" ? "955305" : "955210";
  };

  // TODO: this is getting called too much: twice on start, and after method calls
  setTimeout(LoadMarketplaces, 1);

  return (
    <div className="page-container">
      <h1>DApp Wallet Examples</h1>

      <div className="button-row">
        <select value={network} onChange={ChangeNetwork}>
          <option value="main">Selected Network: main</option>
          <option value="demo">Selected Network: demo</option>
        </select>
      </div>

      <AuthSection walletClient={walletClient} />

      {
        walletClient.loggedIn ?
          <>
            <div className="button-row">
              <label htmlFor="signMsg">Sign a Message:</label>
              <input type="text" size="50" id="signMsg" name="signMsg" />
              <button onClick={Sign}>Sign</button>
            </div>
            <br/>
            <div className="button-row">
              <label htmlFor="nftOwnerToVerify">Verify ELV NFT (owner address):</label>
              <input type="text" size="50" id="nftOwnerToVerify" name="nftOwnerToVerify" />
              <button className="hidden-placeholder"></button>
            </div>
            <div className="button-row">
              <label htmlFor="nftAddressToVerify">Verify ELV NFT (contract address):</label>
              <input type="text" size="50" id="nftAddressToVerify" name="nftAddressToVerify" />
              <button onClick={CheckNft}>Verify Eluvio NFT</button>
            </div>
            <div className="button-row">
              <label htmlFor="flowNft">Verify Flow NFT (contract address):</label>
              <input type="text" size="50" id="flowNft" name="flowNft" />
              <button onClick={async () =>
                await CrossChainAuth("flow", getInput("flowNft"))}>Flow Cross-chain Oracle Query</button>
            </div>
            <div className="button-row">
              <label htmlFor="evmNft">Verify EVM NFT (contract address):</label>
              <input type="text" size="50" id="evmNft" name="evmNft" />
              <button onClick={async () =>
                await CrossChainAuth("eth", getInput("evmNft"))}>EVM Cross-chain Oracle Query</button>
            </div>
            <div className="button-row">
              <label htmlFor="solanaNft">Verify Solana NFT (contract address):</label>
              <input type="text" size="50" id="solanaNft" name="solanaNft" />
              <button onClick={async () => await SignSolana()}>Solana Cross-chain Oracle Query</button>
            </div>
            <br/>
            <div className="button-row">
              <label htmlFor="playoutToken">Embed gated content (access token):</label>
              <input type="text" size="50" id="playoutToken" name="playoutToken" />
              <button className="hidden-placeholder"></button>
            </div>
            <div className="button-row">
              <label htmlFor="playoutVersionHash">Embed gated content (version hash):</label>
              <input type="text" size="50" id="playoutVersionHash" name="playoutVersionHash" />
              <button onClick={Playout}>Embed</button>
            </div>
            <br />
            <h2>User Methods</h2>
            <div className="button-row">
              <button onClick={async () => clearAndShow(await walletClient.UserInfo())}>UserInfo</button>
              <button onClick={async () => clearAndShow(await walletClient.UserItems({sortBy: "default"}))}>UserItems</button>
            </div>
            <div className="button-row">
              <button onClick={async () => clearAndShow(await walletClient.UserItemInfo())}>UserItemInfo</button>
              <button onClick={async () => clearAndShow(await walletClient.AvailableMarketplaces())}>AvailableMarketPlaces</button>
            </div>
            <div className="button-row">
              <button onClick={async () => clearAndShow(await walletClient.client.CreateFabricToken())}>CreateFabricToken</button>
              <button onClick={async () => clearAndShow(
                JSON.stringify(client.utils.DecodeSignedToken(await walletClient.client.CreateFabricToken()))
              )}>DecodeSignedToken</button>
            </div>
            <br />
            <h2>PushServer Methods</h2>
            <div className="button-row">
              <button onClick={async () => await StartListening()}>PushServer listen</button>
              <button onClick={async () => await StopListening()}>PushServer listen stop</button>
            </div>
            <br/>
            <h2>Marketplace Methods</h2>
            <div className="button-row">
              <select id="marketplaceSelector" onChange={ChangeMarketplace}/>
            </div>
            <div className="button-row">
              <button onClick={async () => clearAndShow(await walletClient.Listings({marketplaceParams}))}>Listings</button>
              <button onClick={async () => clearAndShow(await walletClient.MarketplaceStock({marketplaceParams}))}>Stock</button>
            </div>
          </> : null
      }

      {
        inputs ?
          <div>
            <div className="preformat-header">Input</div>
            <pre>{stringify(inputs)}</pre>
          </div> : <><br/><br/><br/></>
      }

      {
        results ?
          <div>
            <div className="preformat-header">Output</div>
            <pre>{stringify(results)}</pre>
          </div> : null
      }

      {
        embed ? <>{embed}</> : null
      }
    </div>
  );
};

render(<React.StrictMode><App /></React.StrictMode>, document.getElementById("app"));