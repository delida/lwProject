import config from './lwconfig';
import BigNumber from 'bignumber.js';
import Chain3 from 'chain3';

var chain3 = new Chain3(new Chain3.providers.HttpProvider(config.vnodeIp)); 
var mc = chain3.mc;


// 子链地址
// var subchainaddr1 = config.subChainAddr;
// var subchainaddr2 = ""

// var baseaddr = config.userAddr;
// var basename = config.pwd;


export function sendshardingflagtx(userAddr,pwd,subchainaddr,amount,code, n, privateKey)
{
	
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
				via: config.via
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
	
	var award=chain3.toSha(amount,'mc')
	var data=deChatInstance.createTopic.getData(award, expblk, desc)
	console.log(data);
	sendshardingflagtx(userAddr, pwd,subchainaddr,amount,data,nonce, privatekey);
}

var deChatABI = config.lwAbi;
var deChatAddr='0x0000000000000000000000000000000000000020'
var deChatContract=chain3.mc.contract(JSON.parse(deChatABI));
var deChatInstance=deChatContract.at(deChatAddr);

export function createSubTopicSol(userAddr, pwd, desc, subchainaddr,topHash, nonce, privatekey)
{
	var data=deChatInstance.creatSubTopic.getData(topHash, desc)
	
	sendshardingflagtx(userAddr, pwd,subchainaddr, "0.1",data,nonce, privatekey)
}

export function voteOnTopic(vote, pwd, subchainaddr,subHash, nonce, privatekey)
{
	var data=deChatInstance.voteOnTopic.getData(subHash)
	sendshardingflagtx(vote,pwd,subchainaddr,'0',data,nonce, privatekey)
}
export function autoCheckSol(userAddr, pwd, subchainaddr, nonce, privatekey)
{
	var data=deChatInstance.autoCheck.getData()
	
	sendshardingflagtx(userAddr, pwd, subchainaddr,'0',data,nonce, privatekey)
}