
## [Eluvio DApp-sample](https://dapp-sample.app.eluv.io/)

This repository illustrates how to develop for the
Eluvio Content Fabric CDN and Marketplace, specifically via an Eluvio
Content Fabric crypto wallet and its associated libraries.

A version of this app is hosted for your convenience at
[https://dapp-sample.app.eluv.io/](https://dapp-sample.app.eluv.io/).

![sample screenshot](images/dapp-sample-screenshot.png)

This DApp is built atop the [Eluvio Media Wallet](https://github.com/eluv-io/elv-media-wallet)
library, and the underlying [Eluvio JS Client Library](https://github.com/eluv-io/elv-client-js).

The library is used for login, retrieving information about the user's assets,
signing transactions (via built-in custodial signing
or connected noncustodial signing wallets), and operating backend
Marketplaces. Additional operations highlighted by this sample:
- NFT ownership validation
- token-gated content access
- embedding of fabric-hosted DRM video in an `<iframe>`
 
The library is documented here:
[Eluvio Wallet Client Documentation](https://eluv-io.github.io/elv-client-js/wallet-client/index.html).
For information about implementing other login options using the wallet and/or frame client, please see
[Login Samples](https://core.test.contentfabric.io/elv-media-wallet-client-test/test-login/).

Furthermore, cross-chain features are available through the Eluvio Javascript Client, documented here:
[Eluvio Javascript Client Documentation](https://eluv-io.github.io/elv-client-js/index.html).
For information on setting such cross-chain policies, see [README.policy.md](README.policy.md).
This operation requires access to the `elv-live` tool [elv-live-js](https://github.com/eluv-io/elv-live-js).

### Explanation of the controls

- Sign: Sign a message, a primitive to prove ownership or provence

- Verify NFT ownership:
   - verify ownership of an Eluvio NFT (demo or main net)
   - Use a cross-chain oracle query to check for ownership on the flow blockchain
   - Use a cross-chain oracle query to check for ownership on an external EVM blockchain

- Embed gated content: used to show how to simplify the embedding of fabric streaming content

- User Methods: calls that get info on the currently logged-in user

- Marketplace methods: calls that get info on the marketplaces for primary and secondary sales


## Source code

The matching source code for the sample is in the `test/wallet-ops` subdirectory.  It was built atop a clone 
of the wallet client, and that code remains in the main `src/` directory for reference. 

There are other samples alongside it in the `test/` directory, feel free to run and reference them, too.