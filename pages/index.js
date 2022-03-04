import { BigNumber, Contract, providers, utils } from "ethers";
import Head from "next/head";
import React, { useEffect, useRef, useState } from "react";
import Web3Modal from "web3modal";
import styles from "../styles/Home.module.css";
import { NFT_CONTRACT_ABI, NFT_CONTRACT_ADDRESS, TOKEN_CONTRACT_ABI, TOKEN_CONTRACT_ADDRESS } from "../constants";

export default function Home() {
    const zero = BigNumber.from(0);

    const [walletConnected, setWalletConnected] = useState(false);
    const [loading, setLoading] = useState(false);

    // tokensToBeClaimed keeps track of the number of tokens that can be claimed
    // based on the Crypto Dev NFT's held by the user for which they havent claimed the tokens
    const [tokensToBeClaimed, setTokensToBeClaimed] = useState(zero);

    // balanceOfCryptoDevTokens keeps track of number of Crypto Dev tokens owned by an address
    const [balanceOfCryptoDevTokens, setBalanceOfCryptoDevTokens] = useState(zero);

    //amount of tokens user wants to mint
    const [tokenAmount, setTokenAmount] = useState(zero);

    // tokensMinted is the total number of tokens that have been minted till now out of 10000(max total supply)
    const [tokensMinted, setTokensMinted] = useState(zero);

    // Create a reference to the Web3 Modal (used for connecting to Metamask) which persists as long as the page is open
    const web3ModalRef = useRef();

    /**
     * getTokensToBeClaimed: checks the balance of tokens that can be claimed by the user
     */
    const getTokensToBeClaimed = async () => {
        try {
            const provider = await getProviderOrSigner();
            const nftContract = new Contract(NFT_CONTRACT_ADDRESS, NFT_CONTRACT_ABI, provider);
            const tokenContract = new Contract(TOKEN_CONTRACT_ADDRESS, TOKEN_CONTRACT_ABI, provider);

            // We will get the signer now to extract the address of the currently connected MetaMask account
            const signer = await getProviderOrSigner(true);
            const address = await signer.getAddress();

            // call the balanceOf from the NFT contract to get the number of NFT's held by the user
            const balance = await nftContract.balanceOf(address);

            // balance is a Big number and thus we would compare it with Big number `zero`
            if (balance === zero) {
                setTokensToBeClaimed(zero);
            } else {
                var amount = 0; //Keep track of number of unclaimed tokens

                //For all NFTS check if tokens have already been claimed
                //Only increase the amount if the tokens have not been claimed for an NFT(for a given tokenId)
                for (var i = 0; i < balance; i++) {
                    const tokenId = await nftContract.tokenOfOwnerByIndex(address, i);
                    const claimed = await tokenContract.tokensIdsClaimed(tokenId);
                    if (!claimes) {
                        amount++;
                    }
                }

                setTokensMinted(BigNumber.from(amount));
            }
        } catch (err) {
            console.error(err);
            setTokensToBeClaimed(zero);
        }
    };

    /**
     * getBalanceOfCryptoDevTokens: checks the balance of Crypto Dev Tokens's held by an address
     */
    const getBalanceOfCryptoDevTokens = async () => {
        try {
            const provider = await getProviderOrSigner();
            const tokenContract = new Contract(TOKEN_CONTRACT_ADDRESS, TOKEN_CONTRACT_ABI, provider);

            // We will get the signer now to extract the address of the currently connected MetaMask account
            const signer = await getProviderOrSigner(true);
            const address = await signer.address();

            // call the balanceOf from the token contract to get the number of NFT's held by the user
            const balance = await tokenContract.balanceOf(address);

            //balance is already a big number, so we dont need to convert it before setting it
            setBalanceOfCryptoDevTokens(balance);
        } catch (err) {
            console.error(err);
            setBalanceOfCryptoDevTokens(zero);
        }
    };

    /**
     * mintCryptoDevToken: mints `amount` number of tokens to a given address
     */

    const mintCryptoDevToken = async (amount) => {
        try {
            //we need the signer since this is a "write" transaction
            const signer = await getProviderOrSigner(true);
            const tokenContract = new Contract(TOKEN_CONTRACT_ABI, TOKEN_CONTRACT_ABI, signer);

            //each token is of "0.001 ether". The value we need to send is `0.001 * amount`
            const value = 0.001 * amount;
            const tx = await tokenContract.mint(amount, {
                //Value signifies the cost of one cryptodev token which is 0.001 eth
                value: utils.parseEther(value.toString())
            });
            setLoading(true);

            //wait for the transaction to get minted
            await tx.wait();
            setLoading(false);
            window.alert("Successfully minted Crypto Dev Tokens");
            await getBalanceOfCryptoDevTokens();
            await getTotalTokensMinted();
            await getTokensToBeClaimed();
        } catch (err) {
            console.error(err);
        }
    };

    /**
     * claimCryptoDevTokens: Helps the user claim Crypto Dev Tokens
     */
    const claimCryptoDevTokens = async () => {
        try {
            const signer = await getProviderOrSigner(true);

            const tokenContract = new Contract(TOKEN_CONTRACT_ADDRESS, TOKEN_CONTRACT_ABI, signer);
            const tx = await tokenContract.claim();
            setLoading(true);

            await tx.wait();
            setLoading(false);

            window.alert("Successfully claimed Crypto Dev Tokens");

            await getBalanceOfCryptoDevTokens();
            await getTotalTokensMinted();
            await getTokensToBeClaimed();
        } catch (err) {
            console.error(err);
        }
    };

    /**
     * getTotalTokensMinted: Retrieves how many tokens have been minted till now
     * out of the total supply
     */
    const getTotalTokensMinted = async () => {
        try {
            const provider = await getProviderOrSigner();
            const tokenContract = new Contract(TOKEN_CONTRACT_ADDRESS, TOKEN_CONTRACT_ABI, provider);

            const _tokensMinted = await tokenContract.totalSupply();
            setTokensMinted(_tokensMinted);
        } catch (err) {
            console.error(err);
        }
    };

    /**
     * Returns a Provider or Signer object representing the Ethereum RPC with or without the
     * signing capabilities of metamask attached
     *
     * A `Provider` is needed to interact with the blockchain - reading transactions, reading balances, reading state, etc.
     *
     * A `Signer` is a special type of Provider used in case a `write` transaction needs to be made to the blockchain, which involves the connected account
     * needing to make a digital signature to authorize the transaction being sent. Metamask exposes a Signer API to allow your website to
     * request signatures from the user using Signer functions.
     *
     * @param {*} needSigner - True if you need the signer, default false otherwise
     */
    const getProviderOrSigner = async (needSigner = false) => {
        //connect to metamask
        const provider = await web3ModalRef.current.connect();
        const web3Provider = new providers.Web3Provider(provider);

        //If user is not connected to the rinkeby network, let them know and throw an error
        const { chainId } = await web3Provider.getNetwork();
        if (chainId !== 4) {
            window.alert("Change the network to Rinkeby");
            throw new Error("Change network to Rinkeby");
        }

        if (needSigner) {
            const signer = web3Provider.getSigner();
            return signer;
        }

        return web3Provider;
    };

    /*
        connectWallet: Connects the MetaMask wallet
      */

    const connectWallet = async () => {
        try {
            await getProviderOrSigner();
            setWalletConnected(true);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        //If wallet is not connected, create a new instance of Web3Modal and connect the Metamask wallet
        if (!walletConnected) {
            web3ModalRef.current = new Web3Modal({
                network: "rinkeby",
                providerOptions: {},
                disableInjectedProvider: false
            });
            connectWallet();
            getTotalTokensMinted();
            getBalanceOfCryptoDevTokens();
            getTokensToBeClaimed();
        }
    }, [walletConnected]);

    const renderButton = () => {
        if (loading) {
            return (
                <div>
                    <button className={styles.button}>Loading...</button>
                </div>
            );
        }

        if (tokensToBeClaimed > 0) {
            return (
                <div>
                    <div className={styles.description}>{tokensToBeClaimed * 10} Tokens can be claimed!</div>
                    <button className={styles.button} onClick={claimCryptoDevTokens}>
                        Claim Tokens
                    </button>
                </div>
            );
        }

        //If user doesnt have any tokens to claim, show the mint button

        return (
            <div style={{ display: "flex-col" }}>
                <div>
                    <input
                        type="number"
                        placeholder="Amount of Tokens"
                        onChange={(e) => setTokenAmount(BigNumber.from(e.target.value))}
                    />
                </div>

                <button
                    onClick={() => mintCryptoDevToken(tokenAmount)}
                    className={styles.button}
                    disabled={!(tokenAmount > 0)}
                >
                    Mint Tokens
                </button>
            </div>
        );
    };

    return (
        <div>
            <Head>
                <title>Crypto Devs</title>
                <meta name="description" content="ICO-Dapp" />
                <link rel="icon" href="/favicon.ico" />
            </Head>
            <div className={styles.main}>
                <div>
                    <h1 className={styles.title}>Welcome to Crypto Devs ICO!</h1>
                    <div className={styles.description}>You can claim or mint Crypto Dev tokens here</div>
                    {walletConnected ? (
                        <div>
                            <div className={styles.description}>
                                {/* Format Ether helps us in converting a BigNumber to string */}
                                You have minted {utils.formatEther(balanceOfCryptoDevTokens)} Crypto Dev Tokens
                            </div>
                            <div className={styles.description}>
                                {/* Format Ether helps us in converting a BigNumber to string */}
                                Overall {utils.formatEther(tokensMinted)}/10000 have been minted!!!
                            </div>
                            {renderButton()}
                        </div>
                    ) : (
                        <button onClick={connectWallet} className={styles.button}>
                            Connect your wallet
                        </button>
                    )}
                </div>
                <div>
                    <img className={styles.image} src="./0.svg" />
                </div>
            </div>

            <footer className={styles.footer}>Made with &#10084; by Crypto Devs</footer>
        </div>
    );
}
