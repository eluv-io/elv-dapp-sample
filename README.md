
## [Eluvio DApp-sample](https://dapp-sample.app.eluv.io/)

This repository illustrates how to develop for the
Eluvio Content Fabric CDN and Marketplace, specificaully via an Eluvio
Content Fabric crypto wallet and its associated libraries.

A version of this app is hosted for your convenience at
[https://dapp-sample.app.eluv.io/](https://dapp-sample.app.eluv.io/).

Various sample operations highlighted include:
- wallet login
- user information access
- marketplace access
- NFT owenership validation
- token-gated content access

![sample screenshot](images/dapp-sample-screenshot.png)

This DApp is built atop the [Eluvio Media Wallet](https://github.com/eluv-io/elv-media-wallet)
library.  It is used for retrieving various information about the user
and their wallet, signing transactions (via built-in custodial signing
or connected non-custodial signing wallets), and operating backend
Marketplace objects.

The Eluvio Media Wallet is available in the Eluvio Wallet Client, documented here:
[Eluvio Wallet Client Documentation](https://eluv-io.github.io/elv-client-js/wallet-client/index.html).
For information about implementing other login options using the wallet and/or frame client, please see
[Login Samples](https://core.test.contentfabric.io/elv-media-wallet-client-test/test-login/).

Furthermore, cross-chain features are available through the The Eluvio Javascript Client, documented here:
[Eluvio Javascript Client Documentation](https://eluv-io.github.io/elv-client-js/index.html).
For information on setting such cross-chain policies, see [README.policy.md](README.policy.md).


## Source code

The matching source code for the sample is in the `test/wallet-ops` subdirectory.  It was built atop a clone 
of the wallet client, and this remains in the main `src/` directory for reference.  We have left this in
this state, alongside a few other `test` apps, to make is easy to build new ones alongside it.


## TODO

Currently this repo HAS THE ENTIRE elv-media-wallet source inside it.

Next order of business is to get rid of all that and import it instead.


