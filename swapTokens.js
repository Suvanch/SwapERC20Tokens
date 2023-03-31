const fetch = require('node-fetch');
const hre = require('hardhat');
const { ethers } = require("ethers");
const { ChainId, Fetcher} = require('@uniswap/sdk');


const WETH =  "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";     //weth address
const router =  "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";   //uniswap v2 router address

//const provider = new hre.ethers.providers.WebSocketProvider("wss://blissful-smart-mansion.quiknode.pro/e998d568073859ab78c3e6f32abefcdcb2cb364d/");
const provider = new hre.ethers.providers.WebSocketProvider("ws://127.0.0.1:8545/");

//const wallet = new ethers.Wallet.fromMnemonic();
const ME = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";    //pulls wallet from private key
const wallet = new hre.ethers.Wallet("ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
const signer = wallet.connect(provider);

const routerContract = new hre.ethers.Contract(
    router,
    [
        'function getAmountsOut(uint amountIn, address[] memory path) public view returns(uint[] memory amounts)',
        'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
        'function swapExactTokensForETHSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external'
    ],
    signer
);

 







//inputs: token address as a string and buy amount in ETH(1 = 1 ETH)
 async function purchaseToken(token_address,buyAmount) {

    const ETHAmountIn = hre.ethers.utils.parseUnits(buyAmount.toString(), 'ether');
    let amounts = await routerContract.getAmountsOut(ETHAmountIn, [WETH, token_address]);
    let amountOutMin = amounts[1].sub(amounts[1].div(10));

    // console.log(ethers.utils.formatEther(ETHAmountIn));
    // console.log(ethers.utils.formatEther(amountOutMin));

    const swapTx = await routerContract.swapExactETHForTokens(
        amountOutMin,
        [WETH, token_address],
        ME,
        Date.now() + 1000 * 60 * 10,
        {'value': ETHAmountIn, 'gasLimit': 900000, 'gasPrice': '0x22ECB25C00'}
    )

    let receipt = await swapTx.wait();
    console.log(receipt);
    
    return true;
}














//inputs: token address as a string and sell amount in #tokens(100 = 100 krz)
//output: to sell EX: 50% or tokens easily
async function sellToken(token_address,sellAmount){
    const slipage = 20; //1%

    //used to get your current wallet balance for the token you want to sell
    //comment this out when testing on hardhat - etherscan is accessing mainnet data
    var url = "https://api.etherscan.io/api?module=account&action=tokenbalance&contractaddress="+token_address+"&address=0x70997970C51812dc3A010C7d01b50e0d17dc79C8&tag=latest&apikey=5B6ERE3CIHRVRZ4HXDWBKISJVPMHE94F2Q"
    var obj = await fetch(url).then((response) => response.json());
    var currentBalance = obj.result;

    if(currentBalance < sellAmount){
        console.log("Insufficient balance");
        return;
    }
    
    var decimals = await getDecimalPlaces(token_address);


    //amount of token you want to sell
    //this needs to be converted to wei, so you need to add the decimals
    var amountIn = ethers.utils.parseUnits(sellAmount.toString(), decimals)
    amountIn = amountIn.toString();

    //the minimum amount of tokens you want to receive
    //this is just the number of tokens you wanr, there is no need to convert it to wei(add the decimals, leave it as a regular number)
    var amountOutMin = sellAmount*(1-slipage/100);
    amountOutMin = ethers.utils.parseUnits(amountOutMin.toString(), 1);
    amountOutMin = amountOutMin.toString();

    //creates contract object
    const ethContract = new hre.ethers.Contract(
        token_address,
        [
            'function approve(address spender, uint256 amount) external returns (bool)'
        ],
        signer
    );

    //approve the router to spend your token
    const approveTx = await ethContract.approve(
        router,
        amountIn
    );
    let reciept = await approveTx.wait();

    //swap the token for ETH
    const swapTx = await routerContract.swapExactTokensForETHSupportingFeeOnTransferTokens(
        amountIn,
        amountOutMin,
        [token_address, WETH],
        ME,
        Date.now() + 1000 * 60 * 10, //max wait time: 10 minutes 
        {'gasLimit': 900000, 'gasPrice': '0x22ECB25C00'} //gas price is 234 Gwei, if no gas price is specified, it will use the default gas price by etherscan
    )

    let receipt = await swapTx.wait();
    console.log(receipt);
    return;
}



async function getDecimalPlaces(tokenAddress) {
  const chainId = ChainId.MAINNET; // Replace with the appropriate chain ID
  const token = await Fetcher.fetchTokenData(chainId, tokenAddress);
  console.log(token);
  return token.decimals;
}


async function main(){
    //await purchaseToken("0xf54b304e2e4b28c7e46619d1a340f9b2b72383d7");
    //await sellToken("0xf54b304e2e4b28c7e46619d1a340f9b2b72383d7",1000000000);
}

main();


//common errors
//reverted with reason string TransferHelper: TRANSFER_FROM_FAILED
//you are asking for more token than you have. so double check if you actually have the input amount, and it gets formatted correctly

//UniswapV2: INSUFFICIENT_OUTPUT_AMOUNT
//output amount is smaller than the amountOutMin. So lower the amountOutMin or doubnle check you are formatting it correctly

//ethers.utils.parseUnits(sellAmount.toString(), decimals)
//this is used to stop errors from bigint, js cant handle big numbers
