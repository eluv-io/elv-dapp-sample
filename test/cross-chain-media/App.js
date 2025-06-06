import "../../src/static/stylesheets/reset.scss";
import "./cross-chain.scss";
import "../../src/static/stylesheets/loaders.scss";

import React, { useEffect, useState } from "react";
import { render } from "react-dom";
import { ElvWalletClient } from "@eluvio/elv-client-js/src/walletClient";
import { PageLoader } from "Components/common/Loaders";

import GithubIcon from "../common/github.svg";
import { CrossChainOracle } from "./CrossChainOracle.js";
import ImageIcon from "Components/common/ImageIcon";

// eluvio EvWalletClient mode -- "staging" or "production"
const mode = "staging";

// eluvio backend network configuration -- "main" or "demo"
const network = new URLSearchParams(window.location.search).get("network-name") || "demo";

// wallet app configuration
const walletAppUrl = network === "demo" ?
  "https://wallet.demov3.contentfabric.io/" :
  "https://wallet.contentfabric.io/";

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
  return networkName === "main" ? "955305" : "955210";
};

const SetDefaults = () => {
  const defaults = {
    evmChain: networkNumber(network),
    evmNft: "0x250d641f36bf16c34467d6533542f96e23c6f2bd",
    flowNft: "0x329feb3ab062d289:CNN_NFT",
    solanaNft: "Ag3m1p1B6FMWKunTQwDW98fLEpcPaobmuthx1u9xLP9q",
    playoutToken: "",
    playoutVersionHash: "hq__BJ4ury6zXvHv4tG4FndgqynDR15ejEwQyeN1sojDvygqtzsfNmpkZnWLvkyfRBHBKFQoCyS53s",
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
          client.CanSign = () => client.loggedIn && client.UserInfo().walletName.toLowerCase() === "metamask";

          setWalletClient(client);
        });
    }
  }, []);

  useEffect(() => {
    if(!walletClient) { return; }

    SetDefaults();
    setInputs(" ");
    setResults({ "result": "<no input>", "examples": new CrossChainOracle(walletClient).allExamples });
  }, [walletClient]);

  if(!walletClient) {
    return (
      <div className="app">
        <PageLoader />
      </div>
    );
  }

  const CheckLogin = () => {
    if(!walletClient.loggedIn) {
      window.console.log("login first");
      setInputs("<login first>");
      setResults("<login first>");
      return false;
    }
    return true;
  };

  const SignSolana = async () => {
    // input is a Mint address, not Token address
    const input = getInput("solanaNft") || "Ag3m1p1B6FMWKunTQwDW98fLEpcPaobmuthx1u9xLP9q";
    // alternative valid contract to test balance == 0: "7bRxdUMy7KoZAv4SXPBNTciWZGGATkSUczv1AjYqWnsT"

    if(!CheckLogin()) { return; }

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

    await window.console.log(await GetPlayout(playoutVersionHash));

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

  const GetPlayout = async (contentHash) => {
    // First retrieve title metadata (title, synopsis, cast, ...)
    let meta = await walletClient.client.ContentObjectMetadata({
      versionHash: contentHash,
      metadataSubtree: "/public/asset_metadata"
    }).catch(err => { return err; });
    window.console.log("META", meta);

    // Retrieve playout info (DASH and HLS URLs)
    let playoutOptions = await walletClient.client.PlayoutOptions({
      versionHash: contentHash,
      drms: ["clear", "aes-128", "fairplay", "widevine"]
    }).catch(err => { return err; });

    return { metadata: meta, playoutOptions: playoutOptions};
  };

  const ChangeNetwork = async (event) => {
    const url = new URL(window.location.href);
    url.search = "network-name=" + event.target.value;
    window.history.replaceState("", "", url.toString());
    window.location = url;
  };

  const CrossChainAuth = async (type, addr, chainId) => {
    window.console.log("CrossChainAuth:", type, addr, chainId);
    if(!CheckLogin()) { return; }

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
    UpdateAuthTokens(res);
  };

  const UpdateAuthTokens = (res) => {
    window.console.log("UpdateAuthTokens:", res);
    const token = res?.msg?.token;
    for(const i of [1, 2, 3, 4, 5, 6]) {
      const iframe = document.getElementById("iframe" + i);
      const src = iframe.src;
      let href = new URL(src);
      href.searchParams.set("ath", token);
      iframe.src = href.toString();
    }
  };

  const GoToMarketplace = async () => {
    const live = "https://wallet.demov3.contentfabric.io/marketplace/iq__2GReTbzD3TM4pXigx6XzNwPCRk5P/store";
    window.open(live, "_blank");
  };

  const ShowPolicy = async () => {
    setResults(`
$ ./elv-live nft_get_policy_permissions iq__2QaBrtbffYaopCLGzU5tXpTHeTfn

name: policy nft-cross-chain
desc: |
  policy for testing access to cross-chain contract nft.
type: ast
expr:
  rule: authorize
rules:
  settings:
    literal:
      authorizedSigners:
        - "0xdD0402bb72FA5554BB79a84ABC8a59E1b8Df4F45"
      authorizedAssets:
        - "flow:mainnet/nonfungibletoken:0x329feb3ab062d289:CNN_NFT"
        - "eip155:1/erc721:0xd4d871419714b778ebec2e22c7c53572b573706e"
        - "eip155:137/erc721:0xfb12a21eea1e1e8825531be2c2329ddcc5a22a7a"
        - "eip155:955210/erc721:0x250d641f36bf16c34467d6533542f96e23c6f2bd"
  authorize:
    rule: validateToken
  isValidTokenSigner:
    in:
      - env: token/adr
      - rule: settings/authorizedSigners
  isValidXcmsg:
    and:
      - in:
          - env: token/ctx/xc_msg/asset
          - rule: settings/authorizedAssets
      - ge:
          - env: token/ctx/xc_msg/results/balance
          - 1
  validateToken:
    and:
      - rule: isValidTokenSigner
      - rule: isValidXcmsg
    `);
  };

  return (
    <div className="page-container">
      <div className="top-bar">
        <h1>Cross-Chain Token-Gated Media</h1>

        <div className="actions">
          <select value={network} onChange={ChangeNetwork}>
            <option value="main">Content Fabric: main</option>
            <option value="demo">Content Fabric: demo</option>
          </select>

          <AuthSection walletClient={walletClient} setWalletClient={setWalletClient} />
        </div>

        <div className="github-container"><a className="source-link" href="https://github.com/eluv-io/elv-dapp-sample/tree/main/test/cross-chain-media" target="_blank">
          <ImageIcon className="-elv-icon github-icon" icon={GithubIcon} />
          Source available on GitHub
        </a></div>
      </div>

      {
          <>
            <div className="video-container">
              <div className="iframe-row">
                <div className="embed-frame">
                  <iframe id="iframe2" width="500" height="240" scrolling="no" marginHeight="0" marginWidth="0" frameBorder="0" type="text/html" allow="encrypted-media"
                    src="https://embed.v3.contentfabric.io/?net=demo&p&ct=h&vid=hq__BJ4ury6zXvHv4tG4FndgqynDR15ejEwQyeN1sojDvygqtzsfNmpkZnWLvkyfRBHBKFQoCyS53s&pst=https://demov3.net955210.contentfabric.io/s/demov3/q/hq__BJ4ury6zXvHv4tG4FndgqynDR15ejEwQyeN1sojDvygqtzsfNmpkZnWLvkyfRBHBKFQoCyS53s/meta/public/asset_metadata/images/hero/default&mt=v&nwm="/>
                  <label>Meridian</label>
                  <label>ELV Movie Ticket & Starflix All-Access</label>
                </div>
                <div className="embed-frame">
                  <iframe id="iframe1" width="500" height="240" scrolling="no" marginHeight="0" marginWidth="0" frameBorder="0" type="text/html" allow="encrypted-media"
                    src="https://embed.v3.contentfabric.io/?net=demo&p&ct=h&vid=hq__8RBeZSEeZKGRucRNFDFN6Td3SgS71Yq2Lz5k4bf773HabL2B22DKxkxWGELPX2kEUQjgBG4wRc&pst=https://demov3.net955210.contentfabric.io/s/demov3/q/hq__8RBeZSEeZKGRucRNFDFN6Td3SgS71Yq2Lz5k4bf773HabL2B22DKxkxWGELPX2kEUQjgBG4wRc/meta/public/asset_metadata/images/hero/default&mt=v&nwm"/>
                  <label>Tears of Steel</label>
                  <label>Starflix All-Access</label>
                </div>
                <div className="embed-frame">
                  <iframe id="iframe3" width="500" height="240" scrolling="no" marginHeight="0" marginWidth="0" frameBorder="0" type="text/html" allow="encrypted-media"
                    src="https://embed.v3.contentfabric.io/?net=demo&p&ct=h&vid=hq__FMoXffaXr5mochFba2MYpQMexQpgmy5tx61CxZRZBZ8K4XFrqcpy9hsLtWGAt5j4Ge8eN6cTGG&pst=https://demov3.net955210.contentfabric.io/s/demov3/q/hq__FMoXffaXr5mochFba2MYpQMexQpgmy5tx61CxZRZBZ8K4XFrqcpy9hsLtWGAt5j4Ge8eN6cTGG/meta/public/asset_metadata/images/hero/default&mt=v&nwm="/>
                  <label>Agent 327</label>
                  <label>Solana Sol Chipmunk & Starflix All-Access</label>
                </div>
              </div>
              <br/>
              <div className="iframe-row">
                <div className="embed-frame">
                  <iframe id="iframe4" width="500" height="240" scrolling="no" marginHeight="0" marginWidth="0" frameBorder="0" type="text/html" allow="encrypted-media"src="https://embed.v3.contentfabric.io/?net=demo&p&ct=h&vid=hq__9xS9V4VpFp9xN9rAQdjD3q1hTWGGz2RpCj9MBTSQaR1nuWrPjpCdxVe1onXTTtg921w8oQxnMK&pst=https://demov3.net955210.contentfabric.io/s/demov3/q/hq__9xS9V4VpFp9xN9rAQdjD3q1hTWGGz2RpCj9MBTSQaR1nuWrPjpCdxVe1onXTTtg921w8oQxnMK/meta/public/asset_metadata/images/hero/default&mt=v&nwm"/>
                  <label>Caminandes (Episode 1) </label>
                  <label>Flow CNN & Ethereum StonerCat & Starflix All-Access</label>
                </div>
                <div className="embed-frame">
                  <iframe id="iframe5" width="500" height="240" scrolling="no" marginHeight="0" marginWidth="0" frameBorder="0" type="text/html" allow="encrypted-media"
                    src="https://embed.v3.contentfabric.io/?net=demo&p&ct=h&vid=hq__2wgaPpzjcRUJsctv7YcjGdqyG6GnuEdtS2fwnFNprQFLCia7XywQ98E57aMNqckUcEgaiQHYwf&pst=https://demov3.net955210.contentfabric.io/s/demov3/q/hq__2wgaPpzjcRUJsctv7YcjGdqyG6GnuEdtS2fwnFNprQFLCia7XywQ98E57aMNqckUcEgaiQHYwf/meta/public/asset_metadata/images/hero/default&mt=v&nwm"/>
                  <label>Caminandes (Episode 2) </label>
                  <label>Flow CNN & Ethereum StonerCat & Starflix All-Access</label>
                </div>
                <div className="embed-frame">
                  <iframe id="iframe6" width="500" height="240" scrolling="no" marginHeight="0" marginWidth="0" frameBorder="0" type="text/html" allow="encrypted-media"
                    src="https://embed.v3.contentfabric.io/?net=demo&p&ct=h&vid=hq__E8fxNTi4Y4MMiEwY7rCt3wTnY8DWpuED2JQbZBNAcZrcqCjSNZ1frCEJ9kVSxXqJZswbCccR92&pst=https://demov3.net955210.contentfabric.io/s/demov3/q/hq__E8fxNTi4Y4MMiEwY7rCt3wTnY8DWpuED2JQbZBNAcZrcqCjSNZ1frCEJ9kVSxXqJZswbCccR92/meta/public/asset_metadata/images/hero/default&mt=v&nwm"/>
                  <label id="live_label1">Caminandes (Episode 3) </label>
                  <label id="live_label2">Polygon & Flow & Ethereum & Starflix All-Access</label>
                </div>
              </div>
            </div>
            <div className="main-content">
              <div className="main-sidebar-controls">
                <div className="form-item">
                  <label htmlFor="evmNft">EVM NFT chain ID:</label>
                  <input type="text" size="50" id="evmChain" name="evmChain" />
                  <label>&nbsp;&nbsp;&nbsp;Chain IDs:</label>
                  <label>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;1: ETH mainnet</label>
                  <label>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;955210: ELV demo</label>
                  <label>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;955305: ELV main</label>
                  <label htmlFor="evmNft" style={{marginTop: 8+ "px"}}>EVM NFT contract address:</label>
                  <input type="text" size="50" id="evmNft" name="evmNft" />
                  <button onClick={async () =>
                    await CrossChainAuth("eth", getInput("evmNft"), getInput("evmChain"))}>Query EVM Cross-chain Oracle</button>
                </div>
                <label style={{marginTop: 12+ "px"}}></label>
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
                <label><b>Generate a gated embed:</b></label>
                <div className="form-item">
                  <label htmlFor="playoutToken">Gated content access token:</label>
                  <input type="text" size="50" id="playoutToken" name="playoutToken" />
                  <label htmlFor="playoutVersionHash">Gated content version hash:</label>
                  <input type="text" size="50" id="playoutVersionHash" name="playoutVersionHash" />
                  <button onClick={Playout}>Embed content</button>
                </div>
                <div className="form-item">
                  <br/>
                  <button onClick={ShowPolicy}>Show Policy Details</button>
                </div>
                <div className="form-item">
                  <button onClick={GoToMarketplace}>Get a Ticket or Starflix Pass</button>
                </div>
              </div>

              <div className="display-section">
                <JsonSection inputs={inputs} results={results} embed={embed} />
              </div>
            </div>
          </>
      }
    </div>
  );
};

render(<React.StrictMode><App /></React.StrictMode>, document.getElementById("app"));
