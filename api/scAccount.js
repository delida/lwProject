import Chain3 from 'chain3';
import config from "./lwconfig.json"
import BigNumber from 'bignumber.js';
import {getVia} from './accountApi';
import {vnodeAddress} from './accountApi';
import {getChain3} from './accountApi';

var chain3 = getChain3();
var userAddr = config.userAddr;
var subChainAddr = config.subChainAddr;
var marketableTokenAddr = config.marketableTokenAddr;

export	function sendtx(src, tgtaddr, amount, strData, privateKey) {
		return new Promise((resolve, reject) => {
			chain3.mc.getTransactionCount(src,function (err, txcount) {
				chain3.version.getNetwork(function (err, version) {
					var rawTx = {
	
						nonce: chain3.intToHex(txcount),
						from: src,
						gas: chain3.intToHex(100000), 
						gasLimit: chain3.intToHex(9000000),
						gasPrice: chain3.intToHex(20000000000),
						to: tgtaddr,
						value: chain3.intToHex(chain3.toSha(amount, 'mc')),
						data: strData,
						shardingFlag: '0x0',
						chainId: chain3.intToHex(version),
					}
					signedTx = chain3.signTransaction(rawTx, privateKey)
					chain3.mc.sendRawTransaction(signedTx, function (err, hash) {
						if (!err) {
							console.log("success");
							resolve("success");
						} else {
							console.log("error:", err.message);
							resolve("fail");
						}
					});
				});
			});

		});

	}


export function getInstance(subChainAddr) {
	chain3 = getChain3();
	var subchainbaseaddr = subChainAddr;
	var subchainbaseAbi = config.subchainbaseAbi;
	var subchainbaseContract=chain3.mc.contract(JSON.parse(subchainbaseAbi));
	var subchainbase=subchainbaseContract.at(subchainbaseaddr);
	return subchainbase;
}
	

export	function testbuyMintToken(sender, passwd, pay, privateKey, subChainAddr)
{
	var data=getInstance(subChainAddr).buyMintToken.getData();
	sendtx(sender, subChainAddr, pay, data, privateKey);
}

export	function testsellMintToken(sender, passwd, amount, privateKey, subChainAddr)
{
	var data=getInstance(subChainAddr).sellMintToken.getData(amount);
	sendtx(sender, subChainAddr, '0', data, privateKey);
}

export	function testrequestEnterMicrochain(sender, passwd, amount, privateKey, subChainAddr)
{
	var data = getInstance(subChainAddr).requestEnterMicrochain.getData(amount);
	return sendtx(sender, subChainAddr, '0', data, privateKey);
}

export function dappredeemFromMicroChain(sender, passwd, amount, nonce, privateKey, subChainAddr)
{
	var via = getVia();
	chain3 = getChain3();
	return new Promise((resolve, reject) => {

		chain3.version.getNetwork(function (err, version) {
			var rawTx = {
				nonce: chain3.intToHex(nonce),
				from: sender,
				gas: '0x0',
				gasLimit: '0x0',//chain3.intToHex(0),
				gasPrice: '0x0',//chain3.intToHex(0),
				to: subChainAddr,
				value: chain3.toHex(amount),
				data: '0x89739c5b',
				shardingFlag: '0x1',
				chainId: chain3.intToHex(version),
				via: via
			}
			var signedTx = chain3.signTransaction(rawTx, privateKey)
			chain3.mc.sendRawTransaction(signedTx, function (err, hash) {
				if (!err) {
					console.log("success");
					resolve("success");
				} else {
					console.log("fail:", err.message);
					reject("fail");
				}
			});

		});
		
	});
}


	
	
	
	
	
	