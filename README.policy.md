
# Setting policy permissions

Given, say,
```
"policyFor": {
    "objectId": "iq__SoPtztGZavHUaSnkMRPQ6T138mp",
    "hash": "hq__8xLaEZhWVTjFifiCZRKNQ3m1BdBRjJ9Q7EwGd6K73TKbtFruiCFeptWcGF9tNkhqNV6Ho5gqr2",
  }
```

let's set a cross-chain policy for it.

First, get the existing policy, in case we need to restore it:

```
$ ./elv-live nft_get_policy_permissions iq__SoPtztGZavHUaSnkMRPQ6T138mp 2>/dev/null | grep -v "NFT.Get" | grep -v Object | grep -v verbose | grep -v Network |  yq eval .policy | jq -r .auth_policy.body | sed 's/\\n/\n/g'
```

Save that to a file for later use and edit it as appropriate.  Based on that,
we create file ~/ops/policy/nft-cross-chain.yml:
```
name: policy nft-cross-chain
desc: |
  policy for testing access to cross-chain contract nft.
  The main rule has to be called 'validateTokenEval':
  - validateToken: validate the token signer and xcmsg in the context
  - eval is a place holder for more useful verification. In this policy
    it verifies a few action for the purpose of the tests.
type: ast
expr:
  rule: authorize
rules:

  settings:
    literal:
      authorizedSigners:
        - "0xdD0402bb72FA5554BB79a84ABC8a59E1b8Df4F45"
      authorizedAssets:
        - "eip155:955305/erc721:0x1E75E48B7C3F1eF82C58E14599B43195B5425998"
        - "eip155:1/erc721:0x3097E2b7b4E670f0366e78eCD39eF940e876f74f"
        - "eip155:955305/erc721:0x1847ab816aaa552d25fb1cf3e038be5c4f5c29b2"
        - "eip155:955210/erc721:0xc21ea77699666e2bb6b96dd20157db08f22cb9c3"
        - "eip155:955210/erc721:0x43842733179fa1c38560a44f1d9067677461c8ca"
        - "eip155:955210/erc20:0x43842733179fa1c38560a44f1d9067677461c8ca"
        - "flow:mainnet/nonfungibletoken:0x329feb3ab062d289:CNN_NFT"

  # entry point - mandatory for client-signed tokens
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
```

Finally, then set this policy into the Content Fabric:
```
$ ./elv-live nft_set_policy_permissions iq__SoPtztGZavHUaSnkMRPQ6T138mp ~/ops/policy/nft-cross-chain.yml
```


