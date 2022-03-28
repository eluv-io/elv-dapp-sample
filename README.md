## [Eluvio Media Wallet](https://wallet.contentfabric.io/#/)

The app for buying, selling and collecting NFTs on the Eluvio Content Fabric.


### Embedding the Eluvio Media Wallet

The Media Wallet can be easily embedded into your web application using the wallet client.

The wallet client works by loading the wallet application in either an iframe or a popup and using message passing to send information and commands to and from your application.

You can use the client to retrieve various information about the user and their wallet, navigate the wallet application to various pages, and register event handlers for when the user logs in or out, or the window is closed.

The Eluvio Live site uses this model, embedding the wallet application in an iframe and controlling it with the client. You can see this in action on Eluvio LIVE sites at [https://live.eluv.io] (https://live.eluv.io/maskverse).

Please read the client documentation for more details:
### [Wallet Client API Documentation](https://eluv-io.github.io/elv-media-wallet/ElvWalletClient.html)

#### Basic Usage

```
npm install "@eluvio/elv-wallet-client"
```

```javascript
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
```



