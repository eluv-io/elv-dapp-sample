
# Eluvio DApp Samples

This repository illustrates how to develop for the Eluvio Content Fabric CDN and Marketplace,
specifically via an Eluvio Content Fabric crypto wallet and its associated libraries.

A version of these apps are hosted for your convenience at:
- [https://dapp-sample.app.eluv.io/](https://dapp-sample.app.eluv.io/)
- [https://dapp-sample-xco.app.eluv.io/](https://dapp-sample-xco.app.eluv.io/)


## Basics DApp -"dapp-sample"

![sample screenshot](images/dapp-sample-screenshot.png)

This DApp is built atop the [Eluvio Media Wallet](https://github.com/eluv-io/elv-media-wallet)
library, and the underlying [Eluvio JS Client Library](https://github.com/eluv-io/elv-client-js).

The library is used for login, retrieving information about the user's assets,
signing, and Marketplace access. Operations highlighted by this sample:
- User methods: calls that get info on the currently logged-in user
- Marketplace methods: calls that get info on the marketplaces for primary and secondary sales
- NFT ownership validation: Use a cross-chain oracle query to check for ownership on an EVM, flow, solana blockchain
- Embed token-gated content: simplify the embedding of fabric-hosted DRM video in an `<iframe>`

The library is documented here:
[Eluvio Wallet Client Documentation](https://eluv-io.github.io/elv-client-js/wallet-client/index.html).
For information about implementing other login options using the wallet and/or frame client, please see
[Login Samples](https://core.test.contentfabric.io/elv-media-wallet-client-test/test-login/).

Cross-chain features are available through the Eluvio Javascript Client, referenced above.
For information on setting such cross-chain policies, see [README.policy.md](README.policy.md).
This operation requires use of the `elv-live` CLI tool [elv-live-js](https://github.com/eluv-io/elv-live-js).

### Setup

To run this sample:
- clone this repo
- run `npm install`
- run `npm run serve-dapp-sample`
- open your browser to [https://localhost:8094](https://localhost:8094)

The matching source code for the sample is in the `test/dapp-sample` subdirectory.  It was built atop a clone
of the wallet client, and that code remains in the main `src/` directory for reference.
There are other samples alongside it in the `test/` directory, feel free to run and reference them, too.
For example, the Cross-Chain Token-Gated Media one we describe next.

### Metamask

If you are logged in via metamask, you'll see an option to test SignPermit which is a
special form of `eth_signTypedData_v4` use in place of `personal_sign` for ethereum signing.

See [How to sign data](https://docs.metamask.io/wallet/how-to/sign-data/) for general details
and [this gist](https://gist.github.com/APTy/f2a6864a97889793c587635b562c7d72) for technical details.


## Cross-Chain Token-Gated Media - "cross-chain-media"

This is a specialized sampler focused on cross-chain authorization and token-gated access to Content Fabric media.

![cross_chain screenshot](images/cross-chain-screenshot.png)


### Setup

To run this sample:
- clone this repo
- run `npm install`
- run `npm run serve-cross-chain-media`
- open your browser to [https://localhost:8094](https://localhost:8094)

The matching source code for the sample is in the `test/cross-chain-media` subdirectory.  It was built atop a clone
of the wallet client, and that code remains in the main `src/` directory for reference.
There are other samples alongside it in the `test/` directory, feel free to run and reference them, too.


### CF Playable Assets

network: demov3

name: Tears of Steel
hash: hq__8RBeZSEeZKGRucRNFDFN6Td3SgS71Yq2Lz5k4bf773HabL2B22DKxkxWGELPX2kEUQjgBG4wRc
objectId: iq__3SpYjqE2gsMkbKtxaLA1HB1Pb6Mg

name: Meridian
hash: hq__BJ4ury6zXvHv4tG4FndgqynDR15ejEwQyeN1sojDvygqtzsfNmpkZnWLvkyfRBHBKFQoCyS53s
objectId: iq__2b7yLgWuVRZKyFXdew7kbSCu5deD

name: Caminandes - Ep 1
hash: hq__9xS9V4VpFp9xN9rAQdjD3q1hTWGGz2RpCj9MBTSQaR1nuWrPjpCdxVe1onXTTtg921w8oQxnMK
objectId: iq__xGNmhvgxi6Nrc9M4kgekXPQgiiZ

name: Caminandes - Ep 2
hash: hq__2wgaPpzjcRUJsctv7YcjGdqyG6GnuEdtS2fwnFNprQFLCia7XywQ98E57aMNqckUcEgaiQHYwf
objectId: iq__fPwqqp139xqLxApiyt6hoSgu3zm

name: Caminandes - Ep 3
hash: hq__KHcKw9YUgR72p1vcYeGHAAd7L9XMHr5QPXnepbSBibhZMQTBpz3DDVHUCrtCTmwyqVvDNhLDcg
objectId: iq__2QaBrtbffYaopCLGzU5tXpTHeTfn


### Blockchain Controlling Assets

Starflix Meridian movie:
- https://media-wallet-dv3.dev.app.eluv.io/#/marketplace/iq__2GReTbzD3TM4pXigx6XzNwPCRk5P/store/Hn5JScGHxJDrCG2VVK485v

Starflicks 'All Access'
- https://media-wallet-dv3.dev.app.eluv.io/#/marketplace/iq__2GReTbzD3TM4pXigx6XzNwPCRk5P/store/5Zb7yp4sHjkjr3UZChy4z7
- contract address 0x250d641f36bf16c34467d6533542f96e23c6f2bd

solana:
- https://explorer.solana.com/address/Ag3m1p1B6FMWKunTQwDW98fLEpcPaobmuthx1u9xLP9q

flow:
- https://flowscan.org/contract/A.329feb3ab062d289.CNN_NFT

ethereum mainnet:
- https://dappradar.com/hub/assets/eth/0xd4d871419714b778ebec2e22c7c53572b573706e/7369
- https://etherscan.io/address/0x5a57ed460bd0368bfcf48dd3dd246a56b4bbb891

polygon:
- https://polygonscan.com/token/0xfb12a21eea1e1e8825531be2c2329ddcc5a22a7a


