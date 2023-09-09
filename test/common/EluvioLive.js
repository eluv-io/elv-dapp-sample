
/**
 * We encapsulate this method separately as it is loaded from an ABI.
 */
export class EluvioLive {

  constructor(wallet) {
    this.client = wallet.client;
  }

  /**
   * Get the NFT balance for a given user address
   *
   * @namedParams
   * @param {string} addr - The NFT contract address
   * @param {string} ownerAddr - A user address to check the balance of
   * @return {Promise<Object>} - Number of tokens owned
   */
  async NftBalanceOf({addr, ownerAddr}) {
    const abi = await fetch("test/common/ElvTradableLocal.abi")
      .then(resp => {
        return resp.text();
      });

    let res = await this.client.CallContractMethod({
      contractAddress: addr,
      abi: JSON.parse(abi),
      methodName: "balanceOf",
      methodArgs: [ownerAddr],
      formatArguments: true,
    });

    return res.toNumber();
  }

  /**
   * Get the account nonce for a given user address
   *
   * @namedParams
   * @param {string} addr - The NFT contract address
   * @param {string} ownerAddr - A user address to check the balance of
   * @return {Promise<Object>} - Nonce number
   */
  async AccountNonce({addr, ownerAddr}) {
    const abi = await fetch("test/common/ElvToken.abi")
      .then(resp => {
        return resp.text();
      });

    let res = await this.client.CallContractMethod({
      contractAddress: addr,
      abi: JSON.parse(abi),
      methodName: "nonces",
      methodArgs: [ownerAddr],
      formatArguments: true,
    });

    window.console.log("nonce", res);
    return res.toNumber();
  }

}
