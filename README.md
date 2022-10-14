
# Eluvio DApp-sample

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
This operation requires use of the `elv-live` CLI tool [elv-live-js](https://github.com/eluv-io/elv-live-js).

## Description of the controls

- Sign: Sign a message, a primitive to prove ownership or provence

- Verify NFT ownership:
   - verify ownership of an Eluvio NFT (demo or main net)
   - Use a cross-chain oracle query to check for ownership on the flow blockchain
   - Use a cross-chain oracle query to check for ownership on an external EVM blockchain

- Embed gated content: used to show how to simplify the embedding of fabric streaming content

- User Methods: calls that get info on the currently logged-in user

- Marketplace methods: calls that get info on the marketplaces for primary and secondary sales

## Setup

To run this sample:
- clone this repo
- run `npm install`
- run `npm run serve-wallet-ops-test`
- open your browser to [https://localhost:8094](https://localhost:8094)

The matching source code for the sample is in the `test/wallet-ops` subdirectory.  It was built atop a clone
of the wallet client, and that code remains in the main `src/` directory for reference.
There are other samples alongside it in the `test/` directory, feel free to run and reference them, too.

## Operation

### Getting Started

To get started, you'll need a Content Fabric wallet account.  You can Sign Up as part of clicking `Login`
on these pages, or, go to the URLs below. Select either the _"demo"_ or _"main"_ network, depending on which
you want to access. _Demo_ aka _demov3_ (our test network) is often the best place to start.

To browse the new wallet you created, go to either:
- _main_: [https://wallet.contentfabric.io/](https://wallet.contentfabric.io/#//profile)
- _demo_: [https://wallet.demov3.contentfabric.io/](https://wallet.demov3.contentfabric.io/#/profile)

Click through to the various marketplaces, listings, and activity, and look at individual NFTs and
their attached content, including their Contract Details.

Once you have an account, go back to the DApp sample UI, and go through the `Login` flow if you're
not already logged in.  It will expand to show a screen with content similar to the screenshot
above. Feel free to press all the buttons, and. look at the matching `Input` and `Output` areas
below the button area to see what they do.  These are the results of fabric API calls.

### Accounts and Content

#### Consumer Wallets

Initially, your account will be empty, with no owned NFTs or access to any particular content.
The section below will touch on creating your own content to be made available to users, but, before we
get there, let's add some existing content.

One choice is to buy things from the primary sales channels ("Marketplaces"), or from the
secondary ones ("Listings").  On the _demo_ network, the payment gateways are attached to staging
networks, so feel free to do that, you won't be charged.
Use card number 4242 4242 4242 4242, a valid future date, and any three-digit CVC.

There are also low-priced items on Eluvio mainnet for those on that network.

That loads items into your consumer wallet, which will makes the buttons on the DApp sample return more
interesting data.

#### Creator Content Fabric Accounts

Realistically, though, as a developer, you'll instead want to create your own content.  To do this,
the next step is to create an account with the Content Fabric Browser -- available here:
- _main_: [https://core.v3.contentfabric.io/#/accounts](https://core.v3.contentfabric.io/#/accounts)
- _demo_: [https://core.demov3.contentfabric.io/#/accounts](https://core.demov3.contentfabric.io/#/accounts)

The docs for this are here: [http://hub.elv/setup/](http://hub.elv/setup/).
Please go there for the rest of the setup directions.  It will instruct you how to create an account
there, with a private key you control, and an account address of the form 0x0357111317AbCe….
Be ready to share that address with us, and we will fund it.  Once you have a funded account,
use the _Browser App_ here:
- _main_: [https://core.v3.contentfabric.io/#/apps/Eluvio%20Fabric%20Browser](https://core.v3.contentfabric.io/#/apps/Eluvio%20Fabric%20Browser)
- _demo_: [https://core.demov3.contentfabric.io/#/apps/Eluvio%20Fabric%20Browser](https://core.demov3.contentfabric.io/#/apps/Eluvio%20Fabric%20Browser)
