import config from './lwconfig';
import BigNumber from 'bignumber.js';
import Chain3 from 'chain3';
import {getVia} from './accountApi';
import {vnodeAddress} from './accountApi';
import {getChain3} from './accountApi';

var chain3 = getChain3();

export function sendshardingflagtx(userAddr,pwd,subchainaddr,amount,code, n, privateKey)
{
	var via = getVia();
	return new Promise(function(resolve, reject){
		
		chain3.version.getNetwork(function (err, version) {
			var rawTx = {
				nonce: chain3.intToHex(n),
				from: userAddr,
				gas: '0x0',
				gasLimit: '0x0',//chain3.intToHex(0),
				gasPrice: '0x0',//chain3.intToHex(0),
				to: subchainaddr,
				value: chain3.toHex(chain3.toSha(amount, 'mc')),
				data: code,
				shardingFlag: '0x1',
				chainId: chain3.intToHex(version),
				via: via
			}
			signedTx = chain3.signTransaction(rawTx, privateKey)
			chain3.mc.sendRawTransaction(signedTx, function (err, hash) {
				if (!err) {
					resolve("success");
	
				} else {
					console.log(err);
					reject("fail");
				}
			});
		});
		
		

	});	
}

export function createTopicSol(userAddr, pwd, amount, expblk, desc, subchainaddr, nonce, privatekey)
{
	
	var award = amount * config.toSha;
	var data=getInstance(subchainaddr).createTopic.getData(award, expblk, desc)
	sendshardingflagtx(userAddr, pwd,subchainaddr,amount,data,nonce, privatekey);
}

export function getInstance(subChainAddr) {
	chain3 = getChain3();
	var deChatABI = config.lwAbi;
	var deChatAddr='0x0000000000000000000000000000000000000020'
	var deChatContract=chain3.mc.contract(JSON.parse(deChatABI));
	return deChatContract.at(deChatAddr);
}


export function createSubTopicSol(userAddr, pwd, desc, subchainaddr,topHash, nonce, privatekey)
{
	var data=getInstance(subchainaddr).creatSubTopic.getData(topHash, desc)
	
	sendshardingflagtx(userAddr, pwd,subchainaddr, "0",data,nonce, privatekey)
}

export function voteOnTopic(vote, pwd, subchainaddr,subHash, nonce, privatekey)
{
	var data=getInstance(subchainaddr).voteOnTopic.getData(subHash)
	sendshardingflagtx(vote,pwd,subchainaddr,'0',data,nonce, privatekey)
}
export function autoCheckSol(userAddr, pwd, subchainaddr, nonce, privatekey)
{
	var data=getInstance(subchainaddr).autoCheck.getData()
	
	sendshardingflagtx(userAddr, pwd, subchainaddr,'0',data,nonce, privatekey)
}

export function setTopicStatusSol(userAddr, pwd, subchainaddr, nonce, privatekey, hash, status)
{
	var data=getInstance(subchainaddr).setTopicStatus.getData(hash, status)
	
	sendshardingflagtx(userAddr, pwd, subchainaddr,'0',data,nonce, privatekey)
}


export function setSubTopicStatusSol(userAddr, pwd, subchainaddr, nonce, privatekey, hash, status)
{
	var data=getInstance(subchainaddr).setSubTopicStatus.getData(hash, status)
	
	sendshardingflagtx(userAddr, pwd, subchainaddr,'0',data,nonce, privatekey)
}