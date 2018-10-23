import config from './lwconfig';

import {_post} from "./HttpFecth"
import {_get} from "./HttpFecth"
import {decrypt} from "./accounts"
import {createTopicSol} from "./subchainclient.js"
import {createSubTopicSol} from "./subchainclient.js"
import {voteOnTopic} from "./subchainclient.js"
import {autoCheckSol} from "./subchainclient.js"
import {AsyncStorage} from 'react-native';
import {getInstance} from "./scAccount.js";
import { promises } from 'fs';


var topicIndex = config.topicIndex;
var subTopicIndex = config.subTopicIndex;
//var url = config.rpcIp;
//var userAddr = config.userAddr;
//var subChainAddr = config.subChainAddr;
var chain3 = new Chain3(new Chain3.providers.HttpProvider(config.vnodeIp));
//var ip = config.rpcIp;
//var port = config.port;
var packPerBlockTime = config.packPerBlockTime;   // 子链出块时间单位s
var decimals = config.decimals;   // 子链token精度
var mc = chain3.mc;

var dechatmanagementaddr = config.manageSolAddress;
var dechatmanagementAbi= config.dechatmanagementAbi;
var dechatmanagementContract=chain3.mc.contract(JSON.parse(dechatmanagementAbi));
var dechatmanagement=dechatmanagementContract.at(dechatmanagementaddr);

export var Bytes2HexString = (b)=> {
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
export var Hexstring2btye = (str)=> {
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
  //console.log(postParam);
    return new Promise(function(resolve, reject){
        _post(rpcIp, data).then((datas) => {
            //console.log("datas---------" + JSON.stringify(datas))
            var rpcResult;
            //console.log(datas.result);
            if (datas.result == undefined) {
                if (datas.error != undefined && datas.error.code == -32000) {
                  // pending
                  rpcResult = "pending";
                } else {
                  rpcResult == "have exception";
                }
                
                
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

export var getHttpInfo = function(word) {
  
  return new Promise(function(resolve, reject){
    var rpcIp = "http://fanyi.youdao.com/openapi.do?keyfrom=f2ec-org&key=1787962561&type=data&doctype=json&version=1.1&q=" + word;
      _get(rpcIp, null).then((datas) => {
        if (datas != undefined && datas.translation != undefined) {
          resolve(datas.translation[0]);
        } else {
          resolve(word);
        }
        
      }); 

  });
   
};

var t = Date.now();  
function sleep(d){  
    while(Date.now() - t <= d);  
}

// 创建问题    yes
export var createTopic = async function (award, desc, duration, userAddr, pwd, keystore, subChainAddr, rpcIp) {
  var privatekeyObj = await decrypt(keystore, pwd);
  var privatekey = privatekeyObj.privateKey + "";
  var result = {};
  try{
      var nonce = await currentNonce(subChainAddr, userAddr, rpcIp);
      createTopicSol(userAddr, pwd, award, duration / config.packPerBlockTime, desc, subChainAddr, nonce, privatekey);
      console.log("创建问题成功-----");
      result.topicHash = "";
      result.isSuccess = 1;
      result.nonce = nonce;
    } catch (e) {
      console.log("创建问题时发生异常-----" + e);
      result.topicHash = "";
      result.isSuccess = 0;
      result.nonce = -1;
    }
    return result;
  // return new Promise((resolve, reject) => {
  //   //var privatekey = decrypt(keystore, pwd).privateKey + "";
  //   AsyncStorage.getItem(userAddr, (error, privatekey) => {
  //     if (error) {
  //         console.log("创建问题获取私钥失败------" + error);
  //     } else {
  //         console.log("创建问题获取私钥成功-----");
  //         try{
  //           var result = {};
  //             var nonce = currentNonce();
  //             createTopicSol(userAddr, pwd, award, duration / config.packPerBlockTime, desc, subChainAddr, nonce, privatekey);
                      
  //             result.topicHash = "";
  //             result.isSuccess = 1;
  //             result.nonce = nonce;
  //             resolve(result);
  //           } catch (e) {
  //             console.log("创建问题时发生异常-----" + e);
  //             result.topicHash = "";
  //             result.isSuccess = 0;
  //             result.nonce = -1;
  //             resolve(result);
  //           }
  //     }
  //   });
    
  // });
  
	
}


// 问题列表   yes
// 1 获取个数  2 循环查找mapping下标  3 根据下标查找topic   4 组装list返回	
export var getTopicList = function (pageNum, pageSize, subChainAddr, rpcIp) {
	// 先获取个数
  return new Promise((resolve, reject) => {
    // 获取topic个数
    var postParam1 = {
      "SubChainAddr": subChainAddr,
      "Request": [
        {
          "Reqtype":0,
          "Storagekey": [],
          "Position": [],
          "Structformat": []
        }
      ]
    };
    getContractInfo(rpcIp,
      "ScsRPCMethod.GetContractInfo",
      postParam1
    ).then((allInfoResult) => {
      var topicNum = allInfoResult["000000000000000000000000000000000000000000000000000000000000000a"];
      if (topicNum == undefined) {
        var blankArr = [];
        resolve(blankArr)
      }
      topicNum = parseInt(topicNum, 16);
      //console.log("topic个数是：-------" + parseInt(topicNum, 16));
      
      // 获取topic mapping 下标
      var topicArr = [];
      var flag = 0;
  
      // 挨个处理topic
      for (var i = 0; i < topicNum; i++) {   // parseInt(topicNum)
        var postParam2 = {
          "SubChainAddr": subChainAddr,
          "Request": [
            {
              "Reqtype":1,
              "Storagekey": [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,10],
              "Position": [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,i]
              
            }
          ]
        };
        getContractInfo(rpcIp,
          "ScsRPCMethod.GetContractInfo",
          postParam2
        ).then(function(keyResult){     // 获取mapping的下标，topicHash
        	//console.log(keyResult);   // { c65a7bb8d6351c1cf70c95a316cc6a92839c986682d98bc35f958f4883f9d2a8: 'a08562daa0eebe69de3cf291896162513e1d11fddc24b5c3066a31a6c1006c68e5' }
          for (var k in keyResult) {     // 只会循环一次
            var key = keyResult[k].substring(2);   // 开头a0舍去  topicHash
            // 根据下标查找topic
            var postParam3 = {
              "SubChainAddr": subChainAddr,
              "Request": [
                {
                  "Reqtype": 2,
                  "Storagekey": [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,5],
                  "Position": Hexstring2btye(key),
                  "Structformat": [49,49,51,49,49,49,49,49,49,49,49,49]
                  
                }
              ]
            };
            getContractInfo(rpcIp,"ScsRPCMethod.GetContractInfo", postParam3).then(function(topicResult){
             // console.log(topicResult);
              // 当前区块高度
              var postParam4 = {
                "SubChainAddr": subChainAddr
              };
              getContractInfo(rpcIp,"ScsRPCMethod.GetBlockNumber", postParam4).then(function(currentBlockNum){

              var topic = {};
            	var str = chain3.sha3(key + topicIndex, {"encoding": "hex"}).substring(2);
            	var prefixStr = str.substring(0, str.length - 3);
            	var suffixStr = str.substring(str.length - 3, str.length);
            	var suffixInt = parseInt(suffixStr, 16);
              
              var topicHash = '0x' + key;
              
             
              var owner = '0x' + topicResult[prefixStr + converHex(suffixInt + 1)].substring(2);
              
              
              var award = topicResult[prefixStr + converHex(suffixInt + 3)]; 
              
              var startBlock = topicResult[prefixStr + converHex(suffixInt + 4)];
              var startBlockNum = chain3.toDecimal('0x' + startBlock.substring(2));
              // if (award == undefined) {
              //    console.log();
              // }
              var duration = parseInt(topicResult[prefixStr + converHex(suffixInt + 5)], 16) * packPerBlockTime
              


                var pastTime = (currentBlockNum - startBlockNum) * config.packPerBlockTime;
                if (duration - pastTime > 10 ) {
                  topic.duration = duration - pastTime;
                  topic.topicHash = topicHash; 
                  topic.owner = owner; 
                  topic.award = chain3.toDecimal('0x' + award.substring(2)) / Math.pow(10, decimals);
                  // topic.duration = duration;
                  var status = topicResult[prefixStr + converHex(suffixInt + 11)];
                  if (status == null || status == undefined) {  // 兼容之前版本
                    topic.status = 0;
                  } else if (status == "01"){
                    topic.status = 1;
                  } else {
                    topic.status = 0;
                  }
                  
                  var descFlag = topicResult[prefixStr + converHex(suffixInt + 2)];
                  if (topic.status == 1) {   // 屏蔽，含有敏感词汇
                    topic.desc = config.sensitiveInfo;
                  } else {
                    if (descFlag.length < 7) {
                      // 长string, 这里代表长度，需要连接
                      var descStr = chain3.sha3(prefixStr + converHex(suffixInt + 2), 
                      {"encoding": "hex"}).substring(2);  // 再做一次hash获取字符串第一部分的key
                      var prefixStr = descStr.substring(0, descStr.length - 3);
                      var suffixStr = descStr.substring(descStr.length - 3, descStr.length);
                      var suffixInt = parseInt(suffixStr, 16);
                      //var owner = topicResult[prefixStr + converHex(suffixInt + 1)]; 
                      var valueArr = [];
                      var descStr = "";
                      for (var k in topicResult) {
                        if (k.indexOf(prefixStr) >= 0) {
                          descStr = descStr + topicResult[k].substring(2);
                        }
                      }
                      
                      // var blankIndex = descStr.indexOf('0000');
                      // if (blankIndex > 0) {
                      //   topic.desc = utf8HexToStr(descStr.substring(0, blankIndex)); // 问题内容
                      // } else {
                      //   topic.desc = utf8HexToStr(descStr);
                      // }
                      topic.desc = utf8HexToStr(descStr).replace(/(^\s*)|(\s*$)/g, "");
                      
                  } else {
                    // 代表内容
                    var blankIndex = descFlag.substring(2).indexOf('0000');
                        // if (blankIndex > 0) {
                        //   topic.desc = utf8HexToStr(descFlag.substring(2).substring(0, blankIndex)); // 问题内容
                        // } else {
                        //   topic.desc = utf8HexToStr(descFlag.substring(2));
                        // }
                        topic.desc = utf8HexToStr(descFlag.substring(2)).replace(/(^\s*)|(\s*$)/g, "");
                  }
                  }
                  
                  
                  // 统计Step
                  // 处理完所有后返回
                  topicArr.push(topic);
                  flag++;
                  if (flag == topicNum ) {  // 循环从0开始
                    resolve(topicArr.sort(compareByTime))
                  }
                } else {
                  // var blankArr = [];
                  // resolve(blankArr)
                  flag++;
                  if (flag == topicNum ) {  // 循环从0开始
                    
                    resolve(topicArr.sort(compareByTime))
                  }
                }
            });
            }).catch(reject)
          }
        }).catch(reject)
      }
    }).catch(reject)
  }).catch(err => {
		console.log('获取问题列表promise异常')
		console.log(err)
	})
}

// 创建回答   yes
export var createSubTopic = async function (topicHash, desc, userAddr, pwd, keystore, subChainAddr, rpcIp) {

  var result = {};
  var privatekeyObj = await decrypt(keystore, pwd);
  var privatekey = privatekeyObj.privateKey + "";
  var nonce = await currentNonce(subChainAddr, userAddr, rpcIp);
  return checkTime (subChainAddr, topicHash,rpcIp,topicIndex).then ((data) => {
    if (data == 0) {
      result.subTopicHash = "";
      result.isSuccess = 2;  // 问题已经过期
      return result;
    } 

    try {
      //var nonce = currentNonce();
      
      createSubTopicSol(userAddr, pwd, desc, subChainAddr, topicHash, nonce, privatekey);
      console.log("创建回答成功------");
      result.subTopicHash = "";
      result.isSuccess = 1;
      result.nonce = nonce;
      return result;

    } catch (e) {
      console.log("创建回答发生异常------" + e);
      result.subTopicHash = "";
      result.isSuccess = 0;
      result.nonce = -1;
      return result;
    }
  
});
//   return new Promise((resolve, reject) => {
    
//     checkTime (subChainAddr, topicHash,rpcIp,topicIndex).then ((data) => {
//       if (data == 0) {
//         result.subTopicHash = "";
//         result.isSuccess = 2;  // 问题已经过期
//         resolve(result);  
//       } 

//     //var privatekey = decrypt(keystore, pwd).privateKey + "";
//     AsyncStorage.getItem(userAddr, (error, privatekey) => {
//       if (error) {
//           console.log("创建回答获取私钥失败------" + error);
//       } else {
//           console.log("创建回答获取私钥成功-----");
//           try {

//             var nonce = currentNonce();
//             createSubTopicSol(userAddr, pwd, desc, subChainAddr, topicHash, nonce, privatekey);
//             result.subTopicHash = "";
//             result.isSuccess = 1;
//             result.nonce = nonce;
//             resolve(result);
      
//           } catch (e) {
//             console.log("创建回答发生异常------" + e);
//             result.subTopicHash = "";
//             result.isSuccess = 0;
//             result.nonce = -1;
//             resolve(result);
//           }
//       }
//     });
    
// });
// });
  
	
}

// 回答列表  (返回subTopicHash, desc, owner, voteCount)
// 先校验问题是否过期
//1 根据topicHash，查找回答hash数组  2 遍历获取到下标，根据下标查找所有回答
export var getSubTopicList = function (topicHash, pageNum, pageSize, subChainAddr, rpcIp, type) {
  // 校验问题是否过期
  var result = {};
	return new Promise((resolve) => { 
    checkTime (subChainAddr, topicHash,rpcIp,topicIndex).then ((data) => {
      if (data == 0 && type == 1) {
        result.isEnable = 0;
        result.subTopicList = [];
        resolve(result);  // 问题已经过期
      } else {
        var topicHashByte = Hexstring2btye(topicHash.substring(2));
	var postParam1 = {"SubChainAddr": subChainAddr,
		"Request": [
			{
				"Reqtype":2,
				"Storagekey": [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,7],
				"Position": topicHashByte,
				"Structformat": [50]
			}
		]
	}
	var subTopicArr = [];
  var flag = 0;
  
	//for (var i = 0; i < parseInt(topicNum); i++) {   // parseInt(topicNum)
	//for (var i = (pageNum - 1) * 3; i < pageNum * pageSize; i++) {   // parseInt(topicNum)
	getContractInfo(rpcIp,"ScsRPCMethod.GetContractInfo", postParam1).then(function(subTopicHashArr){
		var values = [];
		var countFlag = 0;
		for (var k in subTopicHashArr) {
			if (subTopicHashArr[k].length > 7) {
				countFlag++;
			}
    }
    if (countFlag == 0) {
      result.isEnable = 1;
      result.subTopicList = [];
      resolve(result);  // 问题已经过期
    }
      
		for (var k in subTopicHashArr)
	    {
			if (subTopicHashArr[k].length > 7) {
				asyncReturn(subTopicHashArr[k]).then((keyRes) => {
					var key = keyRes;
			        // 根据下标查找topic
			        var postParam2 = {"SubChainAddr": subChainAddr,
							"Request": [
								{
									"Reqtype": 2,
									"Storagekey": [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6],
						    	"Position": Hexstring2btye(key),
									"Structformat": [49, 49, 51, 49, 49, 49, 50, 49]
								}
							]
					};
			        getContractInfo(rpcIp,"ScsRPCMethod.GetContractInfo", postParam2).then(function(subTopicResult){
			        	var subTopic = {};
			        	
		            	var str = chain3.sha3(key + subTopicIndex, {"encoding": "hex"}).substring(2);
		            	var prefixStr = str.substring(0, str.length - 3);
		            	var suffixStr = str.substring(str.length - 3, str.length);
		            	var suffixInt = parseInt(suffixStr, 16);
		            	
		            	var subTopicHash = '0x' + key;
		            	//var owner = '0x' + subTopicResult[prefixStr + converHex(suffixInt + 1)];
		            	if (subTopicResult[prefixStr + converHex(suffixInt + 1)] != undefined) {
                    var owner = '0x' + subTopicResult[prefixStr + converHex(suffixInt + 1)].substring(2);
                    var award = subTopicResult[prefixStr + converHex(suffixInt + 3)]; 
                    var reward = 0;
                    if (award != "" && award != null && award != undefined) {
                      reward = chain3.toDecimal('0x' + award.substring(2)) / Math.pow(10, decimals);
                    }
                    
		            		var voteCount = 0; 
		            		if (subTopicResult[prefixStr + converHex(suffixInt + 5)] != '') {
		            			voteCount = parseInt(subTopicResult[prefixStr + converHex(suffixInt + 5)], 16);
		            		}
		                	subTopic.subTopicHash = subTopicHash;
		                	subTopic.owner = owner;
		                	subTopic.voteCount = voteCount;
                      subTopic.reward = reward;
                      
                      var status = subTopicResult[prefixStr + converHex(suffixInt + 7)];
                      if (status == null || status == undefined) {  // 兼容之前版本
                        subTopic.status = 0;
                      } else if (status == "01"){
                        subTopic.status = 1;
                      } else {
                        subTopic.status = 0;
                      }

                      var descFlag = subTopicResult[prefixStr + converHex(suffixInt + 2)];
                      if (subTopic.status == 1) {   // 屏蔽，含有敏感词汇
                        subTopic.desc = config.sensitiveInfo;
                      } else {
                        if (descFlag.length < 7) {
		              		  	// 长string, 这里代表长度，需要连接
		    	                var descStr = chain3.sha3(prefixStr + converHex(suffixInt + 2), 
		    	                {"encoding": "hex"}).substring(2);  // 再做一次hash获取字符串第一部分的key
		    	                var prefixStr = descStr.substring(0, descStr.length - 3);
		    	                var suffixStr = descStr.substring(descStr.length - 3, descStr.length);
		    	                var suffixInt = parseInt(suffixStr, 16);
		    	                //var owner = topicResult[prefixStr + converHex(suffixInt + 1)]; 
		    	                var valueArr = [];
		    	                var descStr = "";
		    	                for (var k in subTopicResult) {
		    	                  if (k.indexOf(prefixStr) >= 0) {
		    	                    descStr = descStr + topicResult[k].substring(2);
		    	                  }
		    	                }
		    	              	
		    	              	// var blankIndex = descStr.indexOf('0000');
		    	                // if (blankIndex > 0) {
		    	                // 	subTopic.desc = utf8HexToStr(descStr.substring(0, blankIndex)); // 问题内容
		    	                // } else {
		    	                // 	subTopic.desc = utf8HexToStr(descStr);
		    	                // }
                          subTopic.desc = utf8HexToStr(descStr).replace(/(^\s*)|(\s*$)/g, "");
		    	          	} else {
                          // 代表内容
                          // var blankIndex = descFlag.substring(2).indexOf('0000');
                          // if (blankIndex > 0) {
                          //   subTopic.desc = utf8HexToStr(descFlag.substring(2).substring(0, blankIndex)); // 问题内容
                          // } else {
                          //   subTopic.desc = utf8HexToStr(descFlag.substring(2));
                          // }
                          subTopic.desc = utf8HexToStr(descFlag.substring(2)).replace(/(^\s*)|(\s*$)/g, "");
		    	                  
		    	          	}
                      }
		                	
		                	subTopicArr.push(subTopic);
		    	            flag++;
		    	            if (flag == countFlag) {
                        result.isEnable = 1;
                        result.subTopicList = subTopicArr.sort(compareByCount);  // 点赞数倒序
		    	        		  resolve(result);
		    	        	//	return subTopicArr
		    	        	}
		            	} else {
		            		// 此topic没有回复
		            	}
			        	
			        });
				});	
	    }
	    }
		
	});
      }
    });
	
});
	
}


// 查询子链token余额 
export var getMicroChainBalance = function (userAddr, pwd, keystore, subChainAddr, rpcIp) {
	var postParam = {"SubChainAddr": subChainAddr,"Sender": userAddr};
	return getContractInfo(rpcIp, "ScsRPCMethod.GetBalance", postParam).then(function(tokenBalance){
    var balanceRes = 0;
    if (tokenBalance != undefined && tokenBalance != NaN) {
      balanceRes = tokenBalance / Math.pow(10, decimals);
    }
		return balanceRes;
	})
}

// 点赞    yes
export var approveSubTopic = async function (voter, subTopicHash, subChainAddr, pwd, keystore, rpcIp) {

  var result = {};
  var privatekeyObj = await decrypt(keystore, pwd);
  var privatekey = privatekeyObj.privateKey + "";
  try {
    //var nonce = currentNonce();
    var nonce = await currentNonce(subChainAddr, voter, rpcIp);
    voteOnTopic(voter, pwd, subChainAddr, subTopicHash, nonce, privatekey);
    result.isSuccess = 1;
    result.nonce = nonce;
    
  } catch (e) {
    console.log("点赞报错--------" + e);
    result.isSuccess = 0;
    result.nonce = -1;
  }
  return result;

  // return new Promise((resolve) => {
  //   var result = {};
  //   AsyncStorage.getItem(voter, (error, privatekey) => {
  //     if (error) {
  //       console.log("点赞获取私钥失败------" + error);
  //     } else {
  //       console.log("点赞获取私钥成功-----");
  //       try {
  //         var nonce = currentNonce();
  //         voteOnTopic(voter, pwd, subChainAddr, subTopicHash, nonce, privatekey);
  //         result.isSuccess = 1;
  //         result.nonce = nonce;
          
  //       } catch (e) {
  //         console.log("点赞报错--------" + e);
  //         result.isSuccess = 0;
  //         result.nonce = -1;
  //       }
  //       resolve(result);
  //     }
  //   });
  // });
  
  
	
}

// autoCheck
export var autoCheck = async function (userAddr, pwd, keystore, subChainAddr, rpcIp) {

  var privatekeyObj = await decrypt(keystore, pwd);
  var privatekey = privatekeyObj.privateKey + "";

  var nonce = await currentNonce(subChainAddr, userAddr, rpcIp);
  autoCheckSol(userAddr, pwd, subChainAddr, nonce, privatekey);
  return 1;
  // return new Promise((resolve) => {
  //   AsyncStorage.getItem(userAddr, (error, privatekey) => {
  //     if (error) {
  //         console.log("结算获取私钥失败------" + error);
  //     } else {
  //         console.log("结算获取私钥成功-----");
  //         var nonce = currentNonce();
  //         autoCheckSol(userAddr, pwd, subChainAddr, nonce, privatekey);
  //         resolve(1);
  //     }
  //   });
    
  // });
  
}

// 我的链问列表
export var myTopicList = function (userAddr, subChainAddr, pwd,keystore, rpcIp, deployLwSolAdmin) {
  return new Promise ((resolve) => {
    // 先set abi
    var postParam3 = {
      "SubChainAddr": subChainAddr,
      "Sender": deployLwSolAdmin,
      "Data": config.lwAbi
    };
    getContractInfo(rpcIp, "ScsRPCMethod.SetDappAbi", postParam3).then(function(result){
      if (result == "success") {
        // 获取列表
        var postParam3 = {
          "SubChainAddr": subChainAddr,
          "Sender": deployLwSolAdmin,
          "Params": ["getMyTopic", userAddr]
        };
        getContractInfo(rpcIp,"ScsRPCMethod.AnyCall", postParam3).then(function(topicList){
          
          //console.log(topicList);
          // var replaceStr1 = topicList.replace(new RegExp(/\"Hash\":/g),"\"Hash\":\"");
          // var replaceStr2 = replaceStr1.replace(new RegExp(/,\"Owner\":/g),"\",\"Owner\":");
          // var replaceStr3 = replaceStr2.replace(new RegExp(/Owner\":/g),"Owner\":\"");
          // var replaceStr4 = replaceStr3.replace(new RegExp(/BestHash\":/g),"BestHash\":\"");
          // var replaceStr5 = replaceStr4.replace(new RegExp(/,\"SecondBestVote/g),"\",\"SecondBestVote");
          // var replaceStr6 = replaceStr5.replace(new RegExp(/,\"Closed/g),"\",\"Closed");
          
          // var finalStr = replaceStr6.replace(new RegExp(/,\"Desc/g),"\",\"Desc");
          //console.log("---------" + topicList);

          var topicArr = JSON.parse(topicList);
          
          //var topicArr = JSON.parse(topicList);
          var finalArr = [];
          for (key in topicArr) {
            var myTopic = {};
            myTopic.topicHash = "0x" + topicArr[key].Hash;
            myTopic.owner = "0x" + topicArr[key].Owner;
            myTopic.award = chain3.fromSha(topicArr[key].Award, 'mc');
            myTopic.duration = topicArr[key].Expblk * config.packPerBlockTime;
            
            if (topicArr[key].Status == 1) {  // 屏蔽，敏感词汇
              myTopic.status = 1;
              myTopic.desc = config.sensitiveInfo;
            } else {
              myTopic.status = 0;
              myTopic.desc = topicArr[key].Desc;
            }
            
            finalArr.push(myTopic);
          }
          resolve(finalArr);
            
          
        });
      }
    });
  });   
}

// 获取批量中文名称
export var getCnNames = function (names) {
  return new Promise((resolve) => {
    var cnNames = [];
    var flag = 0;
    names.forEach(function (item) {
      getHttpInfo(item).then((data) => {
        cnNames.push(data);
        flag++;
        if (flag == names.length) {
          resolve(cnNames);
        }
      });
    });
    
    
  });
  
}

// 获取版块列表
// export var getBoardList = function () {
//   return new Promise ((resolve) => {
//     dechatmanagement.getBoardlist(1,function(err, result){
//       var boardList = [];
      
//       var arr1 = result[0];
//       var arr2 = result[1];
//       var arr3 = result[2];

//       var subAddrArr = [];
//       var dlsAdminArr = [];
//       var marketableTokenArr = [];
//       var rpcIpArr = [];
//       var boardNameArr = [];
//       var picPathArr = [];
//       var exchangeRateArr = [];

//       for (key in arr1) {
        
//         if (key % 3 == 0) {
//           subAddrArr.push(arr1[key]);
//         }
//         if (key % 3 == 1) {
//           dlsAdminArr.push(arr1[key]);
//         }
//         if (key % 3 == 2) {
//           marketableTokenArr.push(arr1[key]);
//         }
//       }

//       for (key in arr2) {
        
//         if (key % 3 == 0) {
//           rpcIpArr.push(utf8HexToStr(arr2[key].substring(2)));
//         }
//         if (key % 3 == 1) {
//           boardNameArr.push(utf8HexToStr(arr2[key].substring(2)));
//         }
//         if (key % 3 == 2) {
//           picPathArr.push(utf8HexToStr(arr2[key].substring(2)));
//         }
//       }

//       for (key in arr3) {
//         if (key % 2 == 1) {
//           exchangeRateArr.push(arr3[key]);
//         }
//       }

//       var finalArr = [];
//       getCnNames(boardNameArr).then((boardNameCnArr) => {
//         finalArr.push(subAddrArr);
//         finalArr.push(dlsAdminArr);
//         finalArr.push(marketableTokenArr);
//         finalArr.push(rpcIpArr);
//         finalArr.push(boardNameCnArr);
//         finalArr.push(picPathArr);
//         finalArr.push(exchangeRateArr);

//         for (var i = 0; i < subAddrArr.length; i++) {
//           var board = {};
//           board.subChainAddress = finalArr[0][i];
//           board.deployLwSolAdmin = finalArr[1][i];
//           board.marketableTokenAddr = finalArr[2][i];
//           board.rpcIp = finalArr[3][i];
//           board.boardName = finalArr[4][i];
//           board.picPath = finalArr[5][i];
//           board.exchangeRate = finalArr[6][i];
//           boardList.push(board);
//         }
//         resolve(boardList);
//       });
      
//     });
//   });   
// }
export var getBoardList = function () {
  return new Promise ((resolve) => {
    dechatmanagement.getBoardlist(1,function(err, result){
      var boardList = [];
      
      var arr1 = result[0];
      var arr2 = result[1];
      var arr3 = result[2];

      var subAddrArr = [];
      var dlsAdminArr = [];
      var marketableTokenArr = [];
      var rpcIpArr = [];
      var boardNameArr = [];
      var picPathArr = [];
      var exchangeRateArr = [];

      for (key in arr1) {
        
        if (key % 3 == 0) {
          subAddrArr.push(arr1[key]);
        }
        if (key % 3 == 1) {
          dlsAdminArr.push(arr1[key]);
        }
        if (key % 3 == 2) {
          marketableTokenArr.push(arr1[key]);
        }
      }

      for (key in arr2) {
        
        if (key % 3 == 0) {
          rpcIpArr.push(utf8HexToStr(arr2[key].substring(2)));
        }
        if (key % 3 == 1) {
          boardNameArr.push(utf8HexToStr(arr2[key].substring(2)));
        }
        if (key % 3 == 2) {
          picPathArr.push(utf8HexToStr(arr2[key].substring(2)));
        }
      }

      for (key in arr3) {
        if (key % 2 == 1) {
          exchangeRateArr.push(arr3[key]);
        }
      }

      var finalArr = [];
      finalArr.push(subAddrArr);
      finalArr.push(dlsAdminArr);
      finalArr.push(marketableTokenArr);
      finalArr.push(rpcIpArr);
      finalArr.push(boardNameArr);
      finalArr.push(picPathArr);
      finalArr.push(exchangeRateArr);

      for(var i = 0; i < subAddrArr.length; i++) {
        var board = {};
        board.subChainAddress = finalArr[0][i];
        board.deployLwSolAdmin = finalArr[1][i];
        board.marketableTokenAddr = finalArr[2][i];
        board.rpcIp = finalArr[3][i];
        board.boardName = finalArr[4][i];
        board.picPath = finalArr[5][i];
        board.exchangeRate = finalArr[6][i];
        boardList.push(board);
      }
      console.log(boardList);
      resolve(boardList);
    });
  });   
}

// 获取主链，子链当前区块高度，下一轮flush剩余区块数
export var getBlockInfo = function (subChainAddr, rpcIp) {
  return new Promise((resolve) => {
    var blockInfo = {};
    // 主链高度
    mc.getBlockNumber(function (err, blockNumber) {
      
      blockInfo.blockNumber = blockNumber;   // 主链高度

      var postParam1 = { "SubChainAddr": subChainAddr };
      getContractInfo(rpcIp, "ScsRPCMethod.GetBlockNumber", postParam1).then(function (subBlockNumber) {
        blockInfo.subBlockNumber = subBlockNumber;  // 子链高度
        var subchainInstance = getInstance(subChainAddr);

        subchainInstance.getFlushInfo(function (err, flushNumber) {
          //console.log("flushNumber----------"+ flushNumber);
          blockInfo.flushNumber = flushNumber;  // 下一轮flush剩余区块数
          resolve(blockInfo);
        });
      });
    });

  });

}

function converHex(intValue) {   // 确保返回的是两位，单个的前面加0
  var res = intValue.toString(16);
  if (res.length == 1) {
     res = "00" + res
  } else if (res.length == 2) {
    res = res = "0" + res
  }
  return res;
}

function asyncReturn(req) {
	return new Promise((resolve) => {
		if (req.length > 7) {
			var key = req.substring(2);
			resolve(key);
		}
	});
}

// hex16进制转汉字（支持中文和英文）
var readUTF = function (arr) {
              if (typeof arr === 'string') {
                  return arr;
              }
              var UTF = '', _arr = arr;
              for (var i = 0; i < _arr.length; i++) {
                  var one = _arr[i].toString(2),
                      v = one.match(/^1+?(?=0)/);
                  if (v && one.length == 8) {
                      var bytesLength = v[0].length;
                      var store = _arr[i].toString(2).slice(7 - bytesLength);
                      for (var st = 1; st < bytesLength; st++) {
                          store += _arr[st + i].toString(2).slice(2)
                      }
                      UTF += String.fromCharCode(parseInt(store, 2));
                      i += bytesLength - 1
                  } else {
                      UTF += String.fromCharCode(_arr[i])
                  }
              }
              return UTF
  }
  
  var utf8HexToStr = function (str) {
              var buf = [];
              for(var i = 0; i < str.length; i += 2){
                  buf.push(parseInt(str.substring(i, i+2), 16));
              }
              return readUTF(buf);
  }

// 校验当前问题是否过期
function checkTime (subChainAddr, topicHash,rpcIp,topicIndex ) {
  return new Promise((resolve) => {
    var postParam3 = {
      "SubChainAddr": subChainAddr,
      "Request": [
        {
          "Reqtype": 2,
          "Storagekey": [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,5],
            "Position": Hexstring2btye(topicHash.substring(2)),
          "Structformat": [49,49,51,49,49,49,49,49,49,49,49,49]
          
        }
      ]
    };
    getContractInfo(rpcIp,"ScsRPCMethod.GetContractInfo", postParam3).then(function(topicResult){
      
        // 当前区块高度
        var postParam4 = {
          "SubChainAddr": subChainAddr
        };
        getContractInfo(rpcIp,"ScsRPCMethod.GetBlockNumber", postParam4).then(function(currentBlockNum){
  
        var topic = {};
        var str = chain3.sha3(topicHash.substring(2) + topicIndex, {"encoding": "hex"}).substring(2);
        var prefixStr = str.substring(0, str.length - 3);
        var suffixStr = str.substring(str.length - 3, str.length);
        var suffixInt = parseInt(suffixStr, 16);
        
        var startBlock = topicResult[prefixStr + converHex(suffixInt + 4)];
        var startBlockNum = chain3.toDecimal('0x' + startBlock.substring(2));
        var duration = parseInt(topicResult[prefixStr + converHex(suffixInt + 5)], 16) * packPerBlockTime
  
          var pastTime = (currentBlockNum - startBlockNum) * packPerBlockTime;
          if (duration - pastTime <= 10 ) {
            resolve(0);
          } else {
            resolve(1);
          }
      });
    })
  });
    
}


var myNonce = 0;
var blockNumber = 0;
// 登录成功，设置全局nonce
export var setNonce = function (subChainAddr, userAddr, rpcIp) {
    return new Promise ((resolve) => {
      try {
        var postParam = {"SubChainAddr": subChainAddr, "Sender": userAddr};
        mc.getBlockNumber(function(err, num) {
          getContractInfo(rpcIp, "ScsRPCMethod.GetNonce", postParam).then(function(nonce){
            blockNumber = num;
            myNonce = nonce;
            resolve(1);
          });
        });
        
      } catch (e) {
        console.log("-----------设置全局nonce失败" + e);
        resolve(0);
      }
      
    });
} 

// 通用累加器(登陆成功后查询到当前的nonce，返回之后再加一，myNonce中的值是当前nonce的值，类似rpc getNonce)
export var currentNonce = async function (subChainAddr, userAddr, rpcIp) {
  // cache和rpc的blockNumber相等，则继续nonce++，  不等则获取getNonce，传最新的出去
  var postParam = {"SubChainAddr": subChainAddr, "Sender": userAddr};
  
  var num = await new Promise((resolve) => {
    mc.getBlockNumber(function(err, blockNum) {
      resolve(blockNum);
    });
  });
  return getContractInfo(rpcIp, "ScsRPCMethod.GetNonce", postParam).then(function(nonce){
        var flag = 0;
        if (blockNumber == num) {   // 区块高度不变
          flag = myNonce++;  
        } else {   // 区块高度变化
          blockNumber = num;
          if (nonce >= myNonce) {
            myNonce = nonce;
            myNonce++;
            flag =  nonce;

          } else {
            flag = nonce;
            
          }
        }
        return flag;
  });
  // return new Promise((resolve) => {
  //   var postParam = {"SubChainAddr": subChainAddr, "Sender": userAddr};
  //   mc.getBlockNumber(function(err, num) {
  //     getContractInfo(rpcIp, "ScsRPCMethod.GetNonce", postParam).then(function(nonce){
  //       console.log("nonce-----------" + nonce);
  //       if (blockNumber == num) {
  //         resolve(myNonce++);  // 不变
  //       } else {
  //         // 区块高度变化
  //         blockNumber = num;
  //         if (nonce >= myNonce) {
  //           myNonce = nonce;
  //           myNonce++;
  //           resolve(nonce);

  //         } else {
  //           //myNonce++;
  //           resolve(nonce);
            
  //         }
  //       }

  //     });
  //   });

  // });
  
}

// 根据nonce获取操作结果（针对提问，回答，点赞）
export var getResult = function (subChainAddr, userAddr, nonce, rpcIp){
  return new Promise ((resolve) => {
      var postParam = {"SubChainAddr": subChainAddr, "Sender": userAddr, "nonce":nonce};
      getContractInfo(rpcIp, "ScsRPCMethod.GetTxRlt", postParam).then(function(result){
          var flag = 1;  // 成功
          if (result == "pending") {
            flag = 2;   // 处理中
          } else if (result == "0000000000000000000000000000000000000000000000000000000000000000") {
            flag = 0;   // 失败
          }
          resolve(flag);
      })
  });
  

}

// 问题列表，按照剩余时间最少的在最前面
var compareByTime = function (obj1, obj2) {
	var val1 = obj1.duration;
	var val2 = obj2.duration;
    if (val1 < val2) {
        return -1;
    } else if (val1 > val2) {
        return 1;
    } else {
        return 0;
    }            
} 

// 回答列表，按照点赞数最大在最前面排序
var compareByCount = function (obj1, obj2) {
	var val1 = obj1.voteCount;
	var val2 = obj2.voteCount;
    if (val1 < val2) {
        return 1;
    } else if (val1 > val2) {
        return -1;
    } else {
        return 0;
    }            
} 
