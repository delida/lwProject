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
export function registerUser(pwd) {
	var registerInfo = {};
	var privateKey = crypto.randomBytes(32); // new Buffer("93e44cafebdb047d030d2ad5fb78d61d1ac1fdf9b42b7c15dc3586ef2131cb13", 'hex');//
	//crypto.randomBytes(32);//
	
	var publicKey = secp256k1.publicKeyCreate(privateKey, false).slice(1);
	
	var address = keccak('keccak256').update(publicKey).digest().slice(-20);
	
	var privateKeyStr = "0x" + privateKey.toString('hex');
	var addressStr = "0x" + address.toString('hex');
	console.log(addressStr);
	var keystore = encrypt(privateKeyStr, pwd);
	console.log(keystore);
	registerInfo.userAddr = addressStr;
	registerInfo.keystore = keystore;
	return registerInfo;
}


// 登录账户   yes
// 1 输入的userAddr是否在移动端存储的所有keystore中，若不存在直接返回钱包地址或者密码错误
// 2 若存在，传入userAddr, pwd, keystore调用此方法
// 3 pwd和keystore解析出来私钥，地址，对比地址和输入地址是否一致
export function loginUser(addr, pwd, keystore) {
	try {
		
		var keystoreObj = JSON.parse(keystore);
		var decryptVal = decrypt(keystoreObj, pwd);
		var address = decryptVal.address + '';
		var privateKey = decryptVal.privateKey + '';
		if (address.toLowerCase() == addr.toLowerCase()) {
			AsyncStorage.setItem(address.toLowerCase(), privateKey, (error) => {
				if (error) {
					console.log("设置privateKey缓存失败------" + error);
				} else {
					console.log("设置privateKey缓存成功------");
				}
			});
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
export var chargeToken = function (userAddr, value, marketableTokenAddr, pwd, keystore, subChainAddr) {
	return new Promise((resolve, reject) => {
		//var privatekey = decrypt(JSON.parse(keystore), pwd).privateKey + "";

		AsyncStorage.getItem(userAddr, (error, privatekey) => {
			if (error) {
				console.log("充值获取私钥失败------" + error);
			} else {
				console.log("充值获取私钥成功-----");
				try {
					getBalance(userAddr, marketableTokenAddr).then((balance1) => {    // 查询当前erc20余额
						console.log("充值兑换前---------" + JSON.stringify(balance1));
						testbuyMintToken(userAddr, pwd, value,privatekey, subChainAddr); // moac兑换主链erc20
		
						var interval = setInterval(function(){
							console.log("wait for buyToken-----");
							getBalance(userAddr, marketableTokenAddr).then((balance2) => { 
								if(balance1.erc20Balance != balance2.erc20Balance){   // 每3s执行一次查询是否兑换成功
									console.log("充值兑换后---------" + JSON.stringify(balance2));
									console.log("开始子链充值-----");
									
									testrequestEnterMicrochain(userAddr, pwd, chain3.toSha(value, 'mc'),    // 兑换成功则执行子链充值，并跳出interval
										privatekey, subChainAddr).then((data) => {
											if (data == "success") {
												resolve(1);    // 充值流程开始后，返回给前台1
												clearInterval(interval);
											} else {
												resolve(2);   // 充值流程进入失败
											}
									});  
									
								}
							});	
						}, 3000);
					});
					
				} catch (e) {
					console.log("充值报错--------" + e);
					reject(0);
				}
				
			}	
		});


		
	});	
}

export var buyToken = function (userAddr, value) {
	testbuyMintToken(userAddr, pwd, value); 
}


// 提币
export var redeemToken = function (userAddr, value, marketableTokenAddr, pwd, keystore, subChainAddr, rpcIp) {
	return new Promise((resolve, reject) => {
		//var privatekey = decrypt(JSON.parse(keystore), pwd).privateKey + "";

		AsyncStorage.getItem(userAddr, (error, privatekey) => {
			if (error) {
				console.log("提币获取私钥失败------" + error);
			} else {
				console.log("提币获取私钥成功-----");
				try {
					getBalance(userAddr, marketableTokenAddr).then((balance1) => {    // 查询当前erc20余额
						console.log("提币前主链代币---------" + JSON.stringify(balance1));
					var postParam = {"SubChainAddr": subChainAddr, "Sender": userAddr};
			  
					  getContractInfo(rpcIp, "ScsRPCMethod.GetNonce", postParam).then(function(nonce){
						dappredeemFromMicroChain(userAddr, pwd, chain3.toSha(value, 'mc'), nonce, privatekey, subChainAddr).then((data) => {   // 提币
							if (data == "success") {
								console.log("start1-----------");
								// 开始调用定时器
								redeemTimer(userAddr, pwd, value, privatekey, subChainAddr, marketableTokenAddr, balance1);
								console.log("start2-----------");
								resolve(1);
								// var interval = setInterval(function () {
								// 	console.log("wait for redeemToken-----");
								// 	getBalance(userAddr, marketableTokenAddr).then((balance2) => {    // 查询当前erc20余额
			
								// 		if (balance1.erc20Balance != balance2.erc20Balance) {   // 每30s执行一次查询是否兑换成功
								// 			console.log("提币后主链代币---------" + JSON.stringify(balance2));
								// 			console.log("提币成功，开始兑换moac-----");
								// 			testsellMintToken(userAddr, pwd, chain3.toSha(value, 'mc'), privatekey, subChainAddr);  // 提币成功则执行moac兑换，并跳出interval
								// 			clearInterval(interval);
								// 			resolve(1);
								// 		}
								// 	});
								// }, 30000);
							} else {
								resolve(2); 
							}
						});
		
					});
					});
		
				} catch (e) {
					console.log("提币报错--------" + e);
					resolve(0);
				}
			}
		});
	});
	
}

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

