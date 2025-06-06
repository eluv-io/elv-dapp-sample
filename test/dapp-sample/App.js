import "../../src/static/stylesheets/reset.scss";
import "./dapp-sample.scss";
import "../../src/static/stylesheets/loaders.scss";

import React, { useEffect, useState } from "react";
import { render } from "react-dom";
import { ElvWalletClient } from "@eluvio/elv-client-js/src/walletClient";
import { PageLoader } from "Components/common/Loaders";

import { EluvioLive } from "../common/EluvioLive";
import { MarketplaceLoader } from "../common/MarketplaceLoader.js";
import { CrossChainOracle } from "./CrossChainOracle.js";
import ImageIcon from "Components/common/ImageIcon";
import GithubIcon from "../common/github.svg";

// eluvio EvWalletClient mode -- "staging" or "production"
const mode = "production";

// eluvio backend network configuration -- "main" or "demo"
const network = new URLSearchParams(window.location.search).get("network-name") || "main";

// marketplace configuration -- returns { tenantSlug:, marketplaceSlug: }
const marketplaceParams = MarketplaceLoader.parseMarketplaceParams();

// wallet app configuration
const walletAppUrl = network === "demo" ?
  "https://wallet.demov3.contentfabric.io/" :
  "https://wallet.contentfabric.io/";

const networkId = network === "demo" ? "955210" : "955305";

const AuthSection = ({ walletClient, setWalletClient }) => {
  const [loggedIn, setLoggedIn] = useState(walletClient?.loggedIn);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const LogIn = async () => {
    const signInUrl = walletClient.client.authServiceURIs[0] + "/wlt/ory/sign_in";
    const requestBody = {
      media_property: "test-property-slug",
      email,
      password,
      nonce: "sample_nonce",
    };

    try {
      setLoading(true);
      setError("");
      const response = await fetch(signInUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if(!response.ok) {
        window.console.error("Login error:", response.statusText);
        setError("Login failed. Please check your credentials.");
        return;
      }

      const responseData = await response.json();
      // contains "email", "id", "user_addr", "fabric_token", "cluster_token"

      // Initialize the wallet client with the response data
      const token = responseData.fabric_token;
      const addr = responseData.user_addr;
      const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
      walletClient.client.SetStaticToken({ token: responseData.fabric_token });
      await walletClient.SetAuthorization({ fabricToken: token, address: addr, email: email, expiresAt });
      window.console.log("walletClient init to", walletClient.UserInfo());

      walletClient.client.walletAppUrl = walletAppUrl;
      window.walletClient = walletClient;

      setWalletClient(walletClient);
      setLoggedIn(true);
      setError("");
    } catch(err) {
      window.console.error("Login error:", err);
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const LogOut = async () => {
    await walletClient.LogOut();
    setLoggedIn(false);
  };

  if(!loggedIn) {
    return (
      <div className="auth-container">
        <div className="login-form">
          <input
            type="text" placeholder="Email" value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password" placeholder="Password" value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button onClick={LogIn} disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
          {loading && <div className="spinner"></div>} {/* Spinner element */}
          {error && <div className="error-message">{error}</div>}
        </div>
      </div>
    );
  }

  let u = walletClient.UserAddress();
  if(walletClient.UserInfo()) {
    u = walletClient.UserInfo().email + " (" + walletClient.UserAddress().substring(0, 7) + "...)";
  }

  return (
    <div className="auth-container">
      <h2>Logged In as {u}</h2>
      <button onClick={LogOut}>Log Out</button>
    </div>
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
    if(window.walletClient) {
      walletClient.client.walletAppUrl = walletAppUrl;
      walletClient.walletAppUrl = walletAppUrl;
      setWalletClient(window.walletClient);
    } else {
      ElvWalletClient.Initialize({
        network,
        mode
      })
        .then(client => {
          client.walletAppUrl = walletAppUrl;

          // Replace CanSign method to force popup flow for personal sign with custodial wallet user
          client.CanSign = () => client.loggedIn && client.UserInfo()?.walletName?.toLowerCase() === "metamask";

          setWalletClient(client);
        });
    }
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
    msgToSign = msgToSign || "Hello World";
    setInputs({ messageToSign: msgToSign});

    let res;
    if(client.loggedIn && client.UserInfo()?.walletName?.toLowerCase() === "metamask") {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      res = await window.ethereum.request({
        method: "personal_sign",
        params: [accounts[0], msgToSign],
      });
    } else {
      walletClient.client.appUrl = walletAppUrl;
      walletClient.appUrl = walletAppUrl;
      res = await walletClient.PersonalSign({message: msgToSign})
        .catch(err => {
          window.console.error("Sign error:", err);
          setResults("Error signing message: " + err);
          return err;
        });
    }
    setResults(res);
  };

  const SignPermit = async () => {
    const chainId = networkId;
    let from = walletClient.UserAddress();
    let accounts;
    let nonce;

    const contract = "0x899fC7bddc2d9a095e8444F118032f1aE231A9B5";
    const tok = "ELVD Test Token";

    try {
      accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      from = accounts[0];
      nonce = await new EluvioLive(walletClient).AccountNonce({addr: contract, ownerAddr: from});
    } catch(err) {
      window.console.error(err);
      setResults({"sign err": { err }});
    }

    const domain = {
      name: tok,
      version: "1",
      chainId,
      verifyingContract: contract,
    };

    const EIP712Domain = [
      { name: "name", type: "string" },
      { name: "version", type: "string" },
      { name: "chainId", type: "uint256" },
      { name: "verifyingContract", type: "address" },
    ];

    let amount = getInput("signPermitMsg");
    const permit = {
      owner: from,
      spender: "0xb48406b4f2c14a7e02ad55d7323f7286bdcb28f8",
      value: amount,
      nonce: nonce,
      deadline: 20000000000,
    };

    const Permit = [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ];

    const splitSig = (sig) => {
      const pureSig = sig.replace("0x", "");

      const _r = Buffer.from(pureSig.substring(0, 64), "hex");
      const _s = Buffer.from(pureSig.substring(64, 128), "hex");
      const _v = Buffer.from(
        parseInt(pureSig.substring(128, 130), 16).toString(),
      );

      return { _r, _s, _v };
    };

    let sign;
    let r;
    let s;
    let v;

    const msgParams = {
      types: {EIP712Domain, Permit,},
      primaryType: "Permit",
      domain,
      message: permit,
    };

    try {
      setInputs({
        "arg1 to eth_signTypedData_v4 (accounts[0])": accounts[0],
        "arg2 to eth_signTypedData_v4 (JSON.stringify(msgParams))": JSON.stringify(msgParams),
        "msgParams": msgParams});
      sign = await window.ethereum.request({
        method: "eth_signTypedData_v4",
        params: [accounts[0], JSON.stringify(msgParams)],
      });
      const { _r, _s, _v } = splitSig(sign);
      r = `0x${_r.toString("hex")}`;
      s = `0x${_s.toString("hex")}`;
      v = _v.toString();

      setResults({ sign, r, s, v });
    } catch(err) {
      window.console.error(err);
      setResults({"sign err": { err }});
    }
  };

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
    const url = "https://appsvc.svc.eluv.io/push/" + (network === "main" ? "main/" : "dv3/") +
      "register/" + walletClient.UserAddress() + "/" + signature;
    const source = new EventSource(url);
    window.console.log("url:", source.url, "withCreds:", source.withCredentials, "ready:", source.readyState);

    source.onmessage = (event) => {
      window.console.log("OnMessage Called[", count, "]:", event, JSON.parse(event.data));
      count++;
      setResults({ "notification received": JSON.parse(event.data) });
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
    // get the UserItems and take the first valid contractAddress in the list of objects
    const ca = await GetFirstContractAddress(walletClient);
    const inputs = { addr: ca, ownerAddr: walletClient.UserAddress()};
    setInputs(inputs);
    if(!ca) {
      setResults("Must own an item to run sample check; UserItems() is empty.");
      return;
    }

    let ownedOrError = await new EluvioLive(walletClient).NftBalanceOf(inputs)
      .then(balance => {
        return (typeof balance === "number") ? { isOwned: balance > 0, balance: balance } : { err: balance };
      })
      .catch(err => { return { error: err.toString()}; });

    if(ownedOrError?.error) {
      setResults(ownedOrError);
    } else {
      let nftStats = await walletClient.NFTContractStats({contractAddress: inputs.addr})
        .catch(err => { return err; });
      setResults({ ownership: ownedOrError, nftStats: nftStats });
    }
  };

  const GetFirstContractAddress = async (walletClient) => {
    try {
      const userItems = await walletClient.UserItems({ sortBy: "default" });
      if(userItems && userItems.results && userItems.results.length > 0) {
        for(const item of userItems.results) {
          if(item.contractAddress) {
            return item.contractAddress;
          }
        }
      }

      window.console.warn("No valid contractAddress found in UserItems results.");
      return null;
    } catch(error) {
      window.console.error("Error fetching UserItems:", error);
      return null;
    }
  };

  const CreateAndDecodeToken = async (walletClient) => {
    try {
      const token = await walletClient.client.CreateFabricToken();
      const decoded_token = walletClient.utils.DecodeSignedToken(token);
      return { token, decoded_token };
    } catch(error) {
      window.console.error("Error creating or decoding Fabric token:", error);
      return { error: error.message };
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
        <div className="preformat-header">Embedded Content</div>
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

  const CrossChainAuth = async (type, addr, chainId) => {
    window.console.log("CrossChainAuth:", type, addr, chainId);
    if(type === "eth" && !chainId) {
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
  };

  const networkNumber = (networkName) => {
    return networkName === "main" ? "955305" : "955210";
  };

  const JsonSection = ({inputs, results, embed}) => {
    if(!(inputs || results || embed)) {
      inputs = "<none>";
    }

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

  // TODO: this is getting called too much: twice on start, and after method calls
  setTimeout(LoadMarketplaces, 1);

  const client = walletClient.client;
  const isMM = client.loggedIn && client.UserInfo().walletName.toLowerCase() === "metamask";
  const signPermit = (
    <div className="text-button-row">
      <label htmlFor="signPermitMsg">SignPermit (amount):</label>
      <input type="text" size="50" id="signPermitMsg" name="signPermitMsg" />
      <button onClick={SignPermit}>SignPermit</button>
    </div>
  );

  return (
    <div className="page-container">
      <div className="top-bar">
        <h1>DApp Wallet Examples</h1>

        <div className="actions">
          <select value={network} onChange={ChangeNetwork}>
            <option value="main">Content Fabric: main</option>
            <option value="demo">Content Fabric: demo</option>
          </select>

          <AuthSection walletClient={walletClient} setWalletClient={setWalletClient}/>
        </div>

        <div className="github-container"><a className="source-link" href="https://github.com/eluv-io/elv-dapp-sample/tree/main/test/dapp-sample" target="_blank">
          <ImageIcon className="-elv-icon github-icon" icon={GithubIcon} />
          Source available on GitHub
        </a></div>
      </div>

      <div className="video-container">
        <div className="main-sidebar-controls">
          <br/><br/>
          <div className="text-button-row-container">
            <div className="text-button-row">
              <label htmlFor="signMsg">Sign a Message:</label>
              <input type="text" size="50" id="signMsg" name="signMsg" />
              <button onClick={Sign}>Sign</button>
            </div>
            { isMM && signPermit }
            <br/>
            <div className="text-button-row">
              <label htmlFor="evmNft">EVM NFT chain ID:</label>
              <input type="text" size="50" id="evmChain" name="evmChain" />
              <button className="hidden-placeholder"></button>
            </div>
            <div className="text-button-row">
              <label htmlFor="evmNft">EVM NFT contract address:</label>
              <input type="text" size="50" id="evmNft" name="evmNft" />
              <button onClick={async () =>
                await CrossChainAuth("eth", getInput("evmNft"), getInput("evmChain"))}>Query EVM Cross-chain Oracle</button>
            </div>
            <br/>
            <div className="text-button-row">
              <label htmlFor="playoutToken">Gated content access token:</label>
              <input type="text" size="50" id="playoutToken" name="playoutToken" />
              <button className="hidden-placeholder"></button>
            </div>
            <div className="text-button-row">
              <label htmlFor="playoutVersionHash">Gated content version hash:</label>
              <input type="text" size="50" id="playoutVersionHash" name="playoutVersionHash" />
              <button onClick={Playout}>Embed content</button>
            </div>
          </div>
          <br />
          <h2>User Methods</h2>
          <div className="button-row">
            <button onClick={async () => clearAndShow(await walletClient.UserInfo())}>UserInfo</button>
            <button onClick={async () => clearAndShow(await CreateAndDecodeToken(walletClient))}>Create Fabric Token</button>
          </div>
          <div className="button-row">
            <button onClick={async () => clearAndShow(await walletClient.UserItems({sortBy: "default"}))}>UserItems</button>
            <button onClick={async () => clearAndShow(await walletClient.UserListings())}>UserListings</button>
          </div>
          <div className="button-row">
            <button onClick={async () => await CheckNft()}>BalanceOf</button>
            <button onClick={async () => clearAndShow(await walletClient.AvailableMarketplaces())}>AvailableMarketplaces</button>
          </div>
          <br />
          <h2>Marketplace Methods</h2>
          <div className="button-row">
            <select id="marketplaceSelector" onChange={ChangeMarketplace}/>
          </div>
          <div className="button-row">
            <button onClick={async () => clearAndShow(await walletClient.Listings({marketplaceParams}))}>Listings</button>
            <button onClick={async () => clearAndShow(await walletClient.MarketplaceStock({marketplaceParams}))}>Stock</button>
          </div>
          <br/>
          <h2>Notification Service Methods</h2>
          <div className="button-row">
            <button onClick={async () => await StartListening()}>PushService listen</button>
            <button onClick={async () => await StopListening()}>PushService stop</button>
          </div>
          <br/>
          <br/>
        </div>
      </div>

      <div className="display-section">
        <JsonSection inputs={inputs} results={results} embed={embed} />
      </div>
    </div>
  );
};

render(<React.StrictMode><App /></React.StrictMode>, document.getElementById("app"));
