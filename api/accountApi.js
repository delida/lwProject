import secp256k1 from 'secp256k1';
import keccak from 'keccak';
import {_post} from "./HttpFecth"
import {encrypt} from "./accounts"
import {decrypt} from "./accounts"
import {testbuyMintToken} from "./scAccount"
import {testrequestEnterMicrochain} from "./scAccount"
import {dappredeemFromMicroChain} from "./scAccount"
import {testsellMintToken} from "./scAccount"
import {getMicroChainBalance} from "./bussApi"
import {AsyncStorage} from 'react-native';
import {sendtx} from './scAccount'
import {currentNonce} from './bussApi'
import crypto from 'crypto';

import config from "./lwconfig.json"
import assert from "assert"
import Chain3 from 'chain3';

//var pwd = config.pwd;
//var userAddr = config.userAddr;
//var subChainAddr = config.subChainAddr;
var chain3 = new Chain3(new Chain3.providers.HttpProvider(config.vnodeIp));
// var ip = config.rpcIp;
// var port = config.port;
var packPerBlockTime = config.packPerBlockTime;   // 子链出块时间单位s
var decimals = config.decimals;   // 子链token精度
var mc = chain3.mc;

//var marketabletokenaddr = config.marketableTokenAddr;
// var marketabletokenAbi = config.marketabletokenAbi
// var marketabletokenContract=chain3.mc.contract(JSON.parse(marketabletokenAbi));
// export var marketabletoken=marketabletokenContract.at(marketabletokenaddr);

const Bytes2HexString = (b)=> {
    let hexs = "";
    for (let i = 0; i < b.length; i++) {
        let hex = (b[i]).toString(16);
        if (hex.length === 1) {
            hexs = '0' + hex;
        }
        hexs += hex.toUpperCase();
    }
    return hexs;
}
//-----------16进制string转换成bytes32----------//
const Hexstring2btye = (str)=> {
    let pos = 0;
    let len = str.length;
    if (len % 2 != 0) {
        return null;
    }
    len /= 2;
    let hexA = new Array();
    for (let i = 0; i < len; i++) {
        let s = str.substr(pos, 2);
        let v = parseInt(s, 16);
        hexA.push(v);
        pos += 2;
    }
    return hexA;
}

export var getContractInfo = function(rpcIp, methodName, postParam) {
  
    var data = {"jsonrpc": "2.0", "id": 0, "method": methodName, "params": postParam};
  //   data = JSON.stringify(data);
  // console.log(rpcIp);
  // console.log(data)
    return new Promise(function(resolve, reject){
        _post(rpcIp, data).then((datas) => {
            //console.log("datas---------" + JSON.stringify(datas))
			var rpcResult;
			console.log(datas);
            //console.log(datas.result);
            if (datas.result == undefined) {
                rpcResult == "have exception";
            }
            else if (datas.result.Storage == undefined) {
                rpcResult = datas.result;
            } else{
                rpcResult = datas.result.Storage;
            }
            
		    resolve(rpcResult);
        }); 

    });
     
};


///////测试提交
// 创建账户 (scripts环境不可用)
export async function registerUser(pwd) {
	var registerInfo = {};
	var privateKey = crypto.randomBytes(32); // new Buffer("93e44cafebdb047d030d2ad5fb78d61d1ac1fdf9b42b7c15dc3586ef2131cb13", 'hex');//
	//crypto.randomBytes(32);//
	
	var publicKey = secp256k1.publicKeyCreate(privateKey, false).slice(1);
	
	var address = keccak('keccak256').update(publicKey).digest().slice(-20);
	
	var privateKeyStr = "0x" + privateKey.toString('hex');
	var addressStr = "0x" + address.toString('hex');
	var keystore = await encrypt(privateKeyStr, pwd);
	registerInfo.userAddr = addressStr;
	registerInfo.keystore = keystore;
	return registerInfo;
}


// 登录账户   yes
// 1 输入的userAddr是否在移动端存储的所有keystore中，若不存在直接返回钱包地址或者密码错误
// 2 若存在，传入userAddr, pwd, keystore调用此方法
// 3 pwd和keystore解析出来私钥，地址，对比地址和输入地址是否一致
export async function loginUser(addr, pwd, keystore) {
	try {
		var keystoreObj = JSON.parse(keystore);
		var decryptVal = await decrypt(keystoreObj, pwd);
		var address = decryptVal.address + '';
		var privateKey = decryptVal.privateKey + '';
		if (address.toLowerCase() == addr.toLowerCase()) {
			// AsyncStorage.setItem(address.toLowerCase(), privateKey, (error) => {
			// 	if (error) {
			// 		console.log("设置privateKey缓存失败------" + error);
			// 	} else {
			// 		console.log("设置privateKey缓存成功------");
			// 	}
			// });
			return 1
		} else {
			return 0;  // 登录失败
		}	
	} catch (e) {
		if (e.message == "Key derivation failed - possibly wrong password") {
			return 2; // 密码错误
		} else {
			console.log(e);
			return 0;  // 登录失败
		}
		
	}
	
}

// 查询主链的MOAC和erc20余额
export var getBalance = function (userAddr, marketableTokenAddr) {
	return new Promise(function(resolve, reject){
		
		mc.getBalance(userAddr, (err, moacRes) => {
			
			var todata = "0x70a08231" + "000000000000000000000000" + userAddr.substring(2);
			chain3.mc.call({
			to: marketableTokenAddr,  // 合约地址
			data: todata
			}, 'latest', (error, response) => {
				var balance = {};
				balance.moacBalance = chain3.fromSha(moacRes.toString(), 'mc');
				balance.erc20Balance = chain3.fromSha(parseInt(response.substring(2),16), 'mc');
				balance.isSuccess = 1;
				//console.log(balance);
				resolve(balance);
				
			});	
		});
	});	
}


// 充值（moac兑换主链token, 然后充值进子链）
export var chargeToken = async function (userAddr, value, marketableTokenAddr, pwd, keystore, subChainAddr, exchangeRate) {
	var privatekeyObj = await decrypt(JSON.parse(keystore), pwd)
	var privatekey = privatekeyObj.privateKey + "";
	try {
		testbuyMintToken(userAddr, pwd, value, privatekey, subChainAddr);
		return 1;
	} catch (e) {
		console.log("充值报错--------" + e);
		return 0;
	}


}
// export var chargeToken = async function (userAddr, value, marketableTokenAddr, pwd, keystore, subChainAddr, exchangeRate) {
// 		var privatekeyObj = await decrypt(JSON.parse(keystore), pwd)
// 		var privatekey = privatekeyObj.privateKey + "";
// 		try {
// 			getBalance(userAddr, marketableTokenAddr).then((balance1) => {    // 查询当前erc20余额
// 				console.log("充值兑换前---------" + JSON.stringify(balance1));
// 				testbuyMintToken(userAddr, pwd, value, privatekey, subChainAddr); // moac兑换主链erc20

// 				var interval = setInterval(function(){
// 					console.log("wait for buyToken-----");
// 					getBalance(userAddr, marketableTokenAddr).then((balance2) => { 
// 						if(balance1.erc20Balance != balance2.erc20Balance){   // 每3s执行一次查询是否兑换成功
// 							console.log("充值兑换后---------" + JSON.stringify(balance2));
// 							console.log("开始子链充值-----");
							
// 							testrequestEnterMicrochain(userAddr, pwd, chain3.toSha(value * exchangeRate, 'mc'),    // 兑换成功则执行子链充值，并跳出interval
// 								privatekey, subChainAddr).then((data) => {
// 									if (data == "success") {
// 										return 1;    // 充值流程开始后，返回给前台1
// 										clearInterval(interval);
// 									} else {
// 										return 2;   // 充值流程进入失败
// 									}
// 							});  
							
// 						}
// 					});	
// 				}, 3000);
// 			});
			
// 		} catch (e) {
// 			console.log("充值报错--------" + e);
// 			return 0;
// 		}
// 	// return new Promise((resolve, reject) => {
// 	// 	AsyncStorage.getItem(userAddr, (error, privatekey) => {
// 	// 		if (error) {
// 	// 			console.log("充值获取私钥失败------" + error);
// 	// 		} else {
// 	// 			console.log("充值获取私钥成功-----");
// 	// 			try {
// 	// 				getBalance(userAddr, marketableTokenAddr).then((balance1) => {    // 查询当前erc20余额
// 	// 					console.log("充值兑换前---------" + JSON.stringify(balance1));
// 	// 					testbuyMintToken(userAddr, pwd, value, privatekey, subChainAddr); // moac兑换主链erc20
		
// 	// 					var interval = setInterval(function(){
// 	// 						console.log("wait for buyToken-----");
// 	// 						getBalance(userAddr, marketableTokenAddr).then((balance2) => { 
// 	// 							if(balance1.erc20Balance != balance2.erc20Balance){   // 每3s执行一次查询是否兑换成功
// 	// 								console.log("充值兑换后---------" + JSON.stringify(balance2));
// 	// 								console.log("开始子链充值-----");
									
// 	// 								testrequestEnterMicrochain(userAddr, pwd, chain3.toSha(value * exchangeRate, 'mc'),    // 兑换成功则执行子链充值，并跳出interval
// 	// 									privatekey, subChainAddr).then((data) => {
// 	// 										if (data == "success") {
// 	// 											resolve(1);    // 充值流程开始后，返回给前台1
// 	// 											clearInterval(interval);
// 	// 										} else {
// 	// 											resolve(2);   // 充值流程进入失败
// 	// 										}
// 	// 								});  
									
// 	// 							}
// 	// 						});	
// 	// 					}, 3000);
// 	// 				});
					
// 	// 			} catch (e) {
// 	// 				console.log("充值报错--------" + e);
// 	// 				reject(0);
// 	// 			}
				
// 	// 		}	
// 	// 	});
		
// 	// });	
// }

export var buyToken = function (userAddr, value) {
	testbuyMintToken(userAddr, pwd, value); 
}


// 提币
export var redeemToken = async function (userAddr, value, marketableTokenAddr, pwd, keystore, subChainAddr, rpcIp, exchangeRate) {
	var privatekeyObj = await decrypt(JSON.parse(keystore), pwd)
	var privatekey = privatekeyObj.privateKey + "";
	try {
		var postParam = {"SubChainAddr": subChainAddr, "Sender": userAddr};
		return getContractInfo(rpcIp, "ScsRPCMethod.GetNonce", postParam).then(function(nonce){
			dappredeemFromMicroChain(userAddr, pwd, chain3.toSha(value, 'mc'), nonce, privatekey, subChainAddr);
			return 1;
		});
	} catch (e) {
		console.log("提币报错--------" + e);
		return 0;
	}

};

// export var redeemToken = async function (userAddr, value, marketableTokenAddr, pwd, keystore, subChainAddr, rpcIp, exchangeRate) {
// 	return new Promise((resolve, reject) => {
// 		//var privatekey = decrypt(JSON.parse(keystore), pwd).privateKey + "";

// 		AsyncStorage.getItem(userAddr, (error, privatekey) => {
// 			if (error) {
// 				console.log("提币获取私钥失败------" + error);
// 			} else {
// 				console.log("提币获取私钥成功-----");
// 				try {
// 					getBalance(userAddr, marketableTokenAddr).then((balance1) => {    // 查询当前erc20余额
// 						console.log("提币前主链代币---------" + JSON.stringify(balance1));
// 					var postParam = {"SubChainAddr": subChainAddr, "Sender": userAddr};
			  
// 					  getContractInfo(rpcIp, "ScsRPCMethod.GetNonce", postParam).then(function(nonce){
// 						dappredeemFromMicroChain(userAddr, pwd, chain3.toSha(value, 'mc'), nonce, privatekey, subChainAddr).then((data) => {   // 提币
// 							if (data == "success") {
// 								// 开始调用定时器
// 								redeemTimer(userAddr, pwd, value, privatekey, subChainAddr, marketableTokenAddr, balance1);
// 								resolve(1);
// 								// var interval = setInterval(function () {
// 								// 	console.log("wait for redeemToken-----");
// 								// 	getBalance(userAddr, marketableTokenAddr).then((balance2) => {    // 查询当前erc20余额
			
// 								// 		if (balance1.erc20Balance != balance2.erc20Balance) {   // 每30s执行一次查询是否兑换成功
// 								// 			console.log("提币后主链代币---------" + JSON.stringify(balance2));
// 								// 			console.log("提币成功，开始兑换moac-----");
// 								// 			testsellMintToken(userAddr, pwd, chain3.toSha(value, 'mc'), privatekey, subChainAddr);  // 提币成功则执行moac兑换，并跳出interval
// 								// 			clearInterval(interval);
// 								// 			resolve(1);
// 								// 		}
// 								// 	});
// 								// }, 30000);
// 							} else {
// 								resolve(2); 
// 							}
// 						});
		
// 					});
// 					});
		
// 				} catch (e) {
// 					console.log("提币报错--------" + e);
// 					resolve(0);
// 				}
// 			}
// 		});
// 	});
	
// }

// moac转账
export var transferMoac = async function (from, to, amount, pwd, keystore) {

	var privatekeyObj = await decrypt(JSON.parse(keystore), pwd)
	var privatekey = privatekeyObj.privateKey + "";
	return sendtx(from, to, amount, "", privatekey).then((data) => {
		if (data == "success") {
			console.log("moac转账成功------");
			return 1;
		} else {
			return 0;
		}
	});
	// return new Promise((resolve) => {
	// 	AsyncStorage.getItem(from, (error, privatekey) => {
	// 		sendtx(from, to, amount, "", privatekey).then((data) => {
	// 			if (data == "success") {
	// 				resolve(1);
	// 			} else {
	// 				resolve(0);
	// 			}
	// 		});
	// 	});
		
	// });
}	


// coin转账
export var transferCoin = async function (from, to, amount, subChainAddr, pwd, keystore) {

	var privatekeyObj = await decrypt(JSON.parse(keystore), pwd)
	var privatekey = privatekeyObj.privateKey + "";

	chain3.version.getNetwork(function (err, version) {
		var rawTx = {
			nonce: chain3.intToHex(currentNonce()),
			from: from,
			gas: '0x0',
			gasLimit: '0x0',//chain3.intToHex(0),
			gasPrice: '0x0',//chain3.intToHex(0),
			to: subChainAddr, 
			value: chain3.toHex(chain3.toSha(amount, 'mc')),
			data: to,  
			shardingFlag: '0x2',
			chainId: chain3.intToHex(version),
			via: config.via
		}
		signedTx = chain3.signTransaction(rawTx, privatekey)
		chain3.mc.sendRawTransaction(signedTx, function (err, hash) {
			if (!err) {
				console.log("coin转账成功-----");

			} else {
				console.log("coin转账失败-----" + err);
			}
		});
	});
	return 1;
	// return new Promise(function(resolve, reject){
	// 	//var privatekey = decrypt(keystore, pwd).privateKey + "";
	// 	AsyncStorage.getItem(from, (error, privatekey) => {
	// 		chain3.version.getNetwork(function (err, version) {
	// 			var rawTx = {
	// 				nonce: chain3.intToHex(currentNonce()),
	// 				from: from,
	// 				gas: '0x0',
	// 				gasLimit: '0x0',//chain3.intToHex(0),
	// 				gasPrice: '0x0',//chain3.intToHex(0),
	// 				to: subChainAddr, 
	// 				value: chain3.toHex(chain3.toSha(amount, 'mc')),
	// 				data: to,  
	// 				shardingFlag: '0x2',
	// 				chainId: chain3.intToHex(version),
	// 				via: config.via
	// 			}
	// 			signedTx = chain3.signTransaction(rawTx, privatekey)
	// 			chain3.mc.sendRawTransaction(signedTx, function (err, hash) {
	// 				if (!err) {
	// 					resolve(1);
		
	// 				} else {
	// 					console.log(err);
	// 					resolve(0);
	// 				}
	// 			});
	// 		});
	// 	});
		
	// });	
}

// 充值提币历史（充值包括进行中，已完成，   提币包括进行中，已完成。   时间倒叙）
export function myHistoryList(pageNum, pageSize, userAddr, subChainAddr, rpcIp) {
	var postParam = {"SubChainAddr": subChainAddr, "Sender": userAddr};
	return new Promise ((resolve) => {
		getContractInfo(rpcIp, "ScsRPCMethod.GetTransactionRecords", postParam).then(function(result){
			var myHistory = {};
			if (result != null && result != undefined) {
				var enterList = [];
				var redeemList = [];
				var enteringAmt = result.EnteringAmt;
				var enteringtime = result.Enteringtime;
				var enterAmt = result.EnterAmt;
				var entertime = result.Entertime;
	
				var redeemingAmt = result.RedeemingAmt;
				var redeemingtime = result.Redeemingtime;
				var redeemAmt = result.RedeemAmt;
				var redeemtime = result.Redeemtime;
	
				// 充值记录
				if (enteringAmt != null && enteringAmt != undefined) {   // 充值进行中
					for (var i in enteringAmt) {
						var enterInfo1 = {}; 
						enterInfo1.status = 2;
						enterInfo1.amount = chain3.fromSha(enteringAmt[i], "mc")
						if (enteringtime[i] != null && enteringtime[i] != undefined) {
							enterInfo1.timeStr = timestampToTime(enteringtime[i]);
							enterInfo1.timeValue = enteringtime[i];
						}
						enterList.push(enterInfo1);
		
					}
				}
	
				if (enterAmt != null && enterAmt != undefined) {   // 充值已完成
					for (var i in enterAmt) {
						var enterInfo2 = {}; 
						enterInfo2.status = 1;
						enterInfo2.amount = chain3.fromSha(enterAmt[i], "mc");
						if (entertime[i] != null && entertime[i] != undefined) {
							enterInfo2.timeStr = timestampToTime(entertime[i]);
							enterInfo2.timeValue = entertime[i];
						}
						enterList.push(enterInfo2);
					}
				}
				
				
	
				// 提币记录
				if (redeemingAmt != null && redeemingAmt != undefined) {   // 提币进行中
					for (var i in redeemingAmt) {
						var redeemInfo1 = {}; 
						redeemInfo1.status = 2;
						redeemInfo1.amount = chain3.fromSha(redeemingAmt[i], "mc");
						if (redeemingtime[i] != null && redeemingtime[i] != undefined) {
							redeemInfo1.timeStr = timestampToTime(redeemingtime[i]);
							redeemInfo1.timeValue = redeemingtime[i];
						}
						redeemList.push(redeemInfo1);
		
					}
				}
	
				if (redeemAmt != null && redeemAmt != undefined) {   // 提币已完成
					for (var i in redeemAmt) {
						var redeemInfo2 = {}; 
						redeemInfo2.status = 1;
						redeemInfo2.amount = chain3.fromSha(redeemAmt[i], "mc");
						if (redeemtime[i] != null && redeemtime[i] != undefined) {
							redeemInfo2.timeStr = timestampToTime(redeemtime[i]);
							redeemInfo2.timeValue = redeemtime[i];
						}
						redeemList.push(redeemInfo2);
					}
				}
	
				// 时间倒叙
				myHistory.enterList = enterList.sort(compareByTimeValue);
				myHistory.redeemList = redeemList.sort(compareByTimeValue);
	
	
			}
			
			resolve(myHistory);
		});
	});
	
}

// 时间戳转日期
function add0(m) { return m < 10 ? '0' + m : m }
function timestampToTime(shijianchuo) {
	//shijianchuo是整数，否则要parseInt转换
	var time = new Date(shijianchuo  * 1000);
	var y = time.getFullYear();
	var m = time.getMonth() + 1;
	var d = time.getDate();
	var h = time.getHours();
	var mm = time.getMinutes();
	var s = time.getSeconds();
	return y + '-' + add0(m) + '-' + add0(d) + ' ' + add0(h) + ':' + add0(mm) + ':' + add0(s);
}

// function timestampToTime(timestamp) {
// 	var date = new Date(timestamp * 1000);//时间戳为10位需*1000，时间戳为13位的话不需乘1000
// 	var Y = date.getFullYear() + '-';
// 	var M = (date.getMonth()+1 < 10 ? '0'+(date.getMonth()+1) : date.getMonth()+1) + '-';
// 	var D = date.getDate() + ' ';
// 	var h = date.getHours() + ':';
// 	var m = date.getMinutes() + ':';
// 	var s = date.getSeconds();
// 	return Y+M+D+h+m+s;
// }


// 提币定时器
function redeemTimer(userAddr, pwd, value, privatekey, subChainAddr, marketableTokenAddr, balance1) {
	var interval = setInterval(function () {
		console.log("wait for redeemToken-----");
		getBalance(userAddr, marketableTokenAddr).then((balance2) => {    // 查询当前erc20余额

			if (balance1.erc20Balance != balance2.erc20Balance) {   // 每3m执行一次查询是否提币到erc20成功
				console.log("提币后主链代币---------" + JSON.stringify(balance2));
				console.log("提币成功，开始兑换moac-----");
				testsellMintToken(userAddr, pwd, chain3.toSha(value, 'mc'), privatekey, subChainAddr);  // 提币成功则执行moac兑换，并跳出interval
				clearInterval(interval);
			}
		});
	}, 180000);
}



// var myNonce = 0;
// // 登录成功，调用获取当前nonce
// export var currentNonce = function (subChainAddr, userAddr) {
// 	var postParam = {"SubChainAddr": subChainAddr, "Sender": userAddr};
// 	getContractInfo(rpcIp, "ScsRPCMethod.GetNonce", postParam).then(function(nonce){
// 		myNonce = nonce;
// 	});
// } 

// 缓存测试
export var setItem = function(addr, privateKey) {
	AsyncStorage.setItem(addr, privateKey, (error) => {
		if (error) {
			console.log("set fail-----" + error);
		} else {
			console.log("set success");
		}
	});
}

export var getItem = function(addr) {
	var flag = "";
	AsyncStorage.getItem(addr, (error, result) => {
		if (error) {
			console.log("get fail------" + error);
		} else {
			console.log("get success-----" + result);
			flag = result;
			
		}	
	});
	return flag;
}

export var removeItem = function(addr) {
	AsyncStorage.removeItem(addr, (error) => {
		if (!error) {
			console.log("remove success");
		} else {
			console.log("remove fail---------" + error);
		}
	});
} 

// 按照时间倒叙
var compareByTimeValue = function (obj1, obj2) {
	var val1 = obj1.timeValue;
	var val2 = obj2.timeValue;
    if (val1 < val2) {
        return 1;
    } else if (val1 > val2) {
        return -1;
    } else {
        return 0;
    }            
} 
