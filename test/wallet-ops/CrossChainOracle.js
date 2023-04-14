/**
 * ClientSignedTokenXco
 *
 * Create a client-signed-token using a cross-chain oracle signed message (xco_msg) and
 * access fabric resources.
 */

const Pako = require("pako");

const Utils = require("@eluvio/elv-client-js/src/Utils.js");

export class CrossChainOracle {

  constructor(wallet) {
    this.walletClient = wallet;
    this.client = this.walletClient.client;
    this.authServicePath = "/as/xco/view";  // On main/demo net as /as/xco/view

    // FUTURE: migrate hardcoded samples to (i) icon reference material

    this.allExamples = {
      "Ethereum: Stoner Cat": "eip155:1/erc721:0xd4d871419714b778ebec2e22c7c53572b573706e",
      "Polygon: Masked Singer Loyalty Pass": "eip155:137/erc721:0xfb12a21eea1e1e8825531be2c2329ddcc5a22a7a",
      "Solana: Sol chipmunks #627": "solana:4sGjMW1sUnHzSxGspuhpqLDx6wiyjNtZ/nonfungibletoken:Ag3m1p1B6FMWKunTQwDW98fLEpcPaobmuthx1u9xLP9q",
      "Flow: CNN_NFT": "flow:mainnet/nonfungibletoken:0x329feb3ab062d289:CNN_NFT",
      "ELV: Starflix All-Access": "eip155:955210/erc721:0x250d641f36bf16c34467d6533542f96e23c6f2bd",
      "ELV: Movie ticket - Meridian": "eip155:955210/erc721:0x5755ceaa00991d223853f34a9fbc0ae0a5f683d9",
    };

    this.ethSampleXcMsg = {
      "chain_type": "eip155",
      "chain_id": "955210",
      "asset_type": "erc721",
      "asset_id": "0x43842733179fa1c38560a44f1d9067677461c8ca",
      "method": "balance",
    };

    this.flowSampleXcMsg = {
      "chain_type": "flow",
      "chain_id": "mainnet",
      "asset_type": "NonFungibleToken",
      "asset_id": "0x329feb3ab062d289:CNN_NFT",
      "method": "balance",
      "user": "0xcbd420284fd5e19b",
    };

    // To use a local authd dev instance:
    //this.client.authServiceURIs = ["http://127.0.0.1:6546"];
    //this.client.AuthHttpClient.uris = this.client.authServiceURIs;
    //this.authServicePath = "/xco/view";   // On local authd as /xco/view instead of /as/xco/view
  }

  GetXcoMessage = (type, asset, owner, chain_id) => {
    let msg = type == "eth" ? this.ethSampleXcMsg : this.flowSampleXcMsg;
    msg.user = !owner ? msg.user : owner;
    msg.chain_id = chain_id;

    // hacky, default to valid contract on mainnet
    msg.asset_id = type == "eth" && chain_id == "955305" ? "0xddca2448a13b26986da0a934386277759ac0e412" : msg.asset_id;
    // then override with typed, if set
    msg.asset_id = !asset ? msg.asset_id : asset;

    return msg;
  }

  /**
   * Make a cross-chain oracle 'view' API call
   */
  SendXcoMessage = async ({msg}) => {
    // Need an owner-signed token in order to access the cross-chain oracle API
    let token = await this.walletClient.AuthToken();

    if(msg.chain_type === "eip155" && this.walletClient.UserInfo().walletName === "Metamask") {
      try {
        const address = await this.walletClient.UserInfo().address;
        window.console.log("is MetaMask", this.walletClient.UserInfo(), msg, address);
        const ps = await window.ethereum.request({
          method: "personal_sign",
          params: [JSON.stringify(msg), address],
        });
        window.console.log("personal_sign", ps);
      } catch (err) {
        window.console.log("mm err", err);
      }
    }
    window.console.log("submitting xco msg", msg);
    window.console.log("with token", client.utils.DecodeSignedToken(token), token);

    return await Utils.ResponseToFormat(
      "json",
      this.client.authClient.MakeAuthServiceRequest({
        method: "POST",
        path: this.authServicePath,
        body: msg,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
    );
  };

  CreateEthFabricToken = async ({
    duration=24 * 60 * 60 * 1000,
    spec={},
    address,
  }={}) => {
    let token = {
      ...spec,
      sub:`iusr${Utils.AddressToHash(address)}`,
      adr: Buffer.from(address.replace(/^0x/, ""), "hex").toString("base64"),
      spc: await this.walletClient.client.ContentSpaceId(),
      iat: Date.now(),
      exp: Date.now() + duration,
    };
    window.console.log("token", token);

    let message = `Eluvio Content Fabric Access Token 1.0\n${JSON.stringify(token)}`;

    const signature = await window.ethereum.request({
      method: "personal_sign",
      params: [JSON.stringify(message), address],
    });

    const compressedToken = Pako.deflateRaw(Buffer.from(JSON.stringify(token), "utf-8"));
    return `acspjc${this.walletClient.client.utils.B58(
      Buffer.concat([
        Buffer.from(signature.replace(/^0x/, ""), "hex"),
        Buffer.from(compressedToken)
      ])
    )}`;
  };

  Run = async (type, msg) => {
    // Call the oracle cross-chain 'view' API 'balance'
    let xcMsg = await this.SendXcoMessage({msg: msg});
    const balance = xcMsg?.ctx?.xc_msg?.results?.balance;
    window.console.log("balance", balance);
    return { msg: xcMsg };
  };
}
