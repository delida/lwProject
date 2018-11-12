import config from './lwconfig';

import {_post} from "./HttpFecth"
import {_get} from "./HttpFecth"
import {decrypt} from "./accounts"
import {createTopicSol} from "./subchainclient.js"
import {createSubTopicSol} from "./subchainclient.js"
import {voteOnTopic} from "./subchainclient.js"
import {autoCheckSol} from "./subchainclient.js"
import {setTopicStatusSol} from "./subchainclient.js"
import {setSubTopicStatusSol} from "./subchainclient.js"
import {AsyncStorage} from 'react-native';
import {getInstance} from "./scAccount.js";
import { promises } from 'fs';
import {vnodeAddress} from './accountApi';
import {getChain3} from './accountApi';
import {getRpcIp} from './accountApi';
import {commonSetVnode} from './accountApi';
import {getCurrentTime} from './accountApi';


var topicIndex = config.topicIndex;
var subTopicIndex = config.subTopicIndex;
var chain3 = getChain3();
var packPerBlockTime = config.packPerBlockTime;   // 子链出块时间单位s
var decimals = config.decimals;   // 子链token精度

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
    var dataVal = "";
    return new Promise(function(resolve, reject){
        _post(rpcIp, data).then((datas) => {
          dataVal += datas; 
            var rpcResult;
            if (datas.result == undefined) {
                if (datas.error != undefined && datas.error.code == -32000) {
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

// 中英文互译接口（暂不用）
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
export function sleep(d){  
    while(Date.now() - t <= d);  
}

// 创建问题    yes
export var createTopic = async function (award, desc, duration, userAddr, pwd, keystore, subChainAddr, rpcIp) {
  var privatekeyObj = await decrypt(keystore, pwd);
  var privatekey = privatekeyObj.privateKey + "";
  var result = {};
  var rpcIp = getRpcIp();
  try{
      var nonce = await currentNonce(subChainAddr, userAddr, rpcIp);
      var descEncode = AsciiToUnicode(desc);  
      createTopicSol(userAddr, pwd, award, duration / config.packPerBlockTime, descEncode, subChainAddr, nonce, privatekey);
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
}


// 问题列表 
export var getTopicList = function (pageNum, pageSize, subChainAddr, rpcIp, deployLwSolAdmin, userAddr) {

  return new Promise((resolve, reject) => {
    var start = new Date().getTime();
    var chain3 =  getChain3();
    var rpcIp = getRpcIp();
    var topicArr = [];
    var isOwner = 0;
    var responseRes = {};
    // 先set abi
    var postParam1 = {
      "SubChainAddr": subChainAddr,
      "Sender": deployLwSolAdmin,
      "Data": config.lwAbi
    };
    try {
      getContractInfo(rpcIp, "ScsRPCMethod.SetDappAbi", postParam1).then(function(result){
        if (result == "success") {
          // 获取列表
          var postParam1 = {
            "SubChainAddr": subChainAddr,
            "Sender": deployLwSolAdmin,
            "Params": ["getTopicList", config.pageNum, config.pageSize]
          };
          var postParam4 = {
            "SubChainAddr": subChainAddr
          };
          getContractInfo(rpcIp,"ScsRPCMethod.GetBlockNumber", postParam4).then(function(currentBlockNum){
            getContractInfo(rpcIp,"ScsRPCMethod.AnyCall", postParam1).then(function(topicList){
  
              getBoardOwner(rpcIp, subChainAddr, deployLwSolAdmin).then((ownerAddr) => {
                if (userAddr == ownerAddr) {
                  // 当前登录人是版主
                  isOwner = 1;
                }
                //topicList = topicList.replace(/\n/g, "-456");
                if (topicList == "" || topicList == null || topicList == undefined){
                  responseRes.isOwner = isOwner;
                  responseRes.topicArr = topicArr;
                  resolve(responseRes);
                }
                var listObj = JSON.parse(topicList);
                listObj.forEach(function (item, index) {
                  var surplusBlk = item.Expblk - (currentBlockNum - item.Startblk);
                  if (surplusBlk > 1 ) {
                    var topicInfo = {};
                    topicInfo.topicHash = "0x" + item.Hash;
                    //topicInfo.desc = item.Desc.replace(/-456/g, "\n");
                    var descValue = UnicodeToAscii(item.Desc);
                    if (descValue == "") {
                      topicInfo.desc = item.Desc;//.replace(/-456/g, "\n");
                    } else {
                      topicInfo.desc = descValue;
                    }
                    
                    topicInfo.award = chain3.fromSha(item.Award, "mc");
                    topicInfo.owner = "0x" + item.Owner;
                    topicInfo.status = item.Status;
                    if (topicInfo.status == 1) {
                      topicInfo.desc = config.sensitiveInfo;
                    }
                    topicInfo.duration = surplusBlk * config.packPerBlockTime;
                    topicArr.push(topicInfo);
                  }
                  
                });
                var end = new Date().getTime();
                console.log("getTopicList接口调用耗时为：");
                console.log((end-start)/1000);
                responseRes.isOwner = isOwner;
                responseRes.topicArr = topicArr.sort(compareByTime);
                resolve(responseRes);
              });
              
            });
          });
          
        }
      });
    } catch (e) {
      responseRes.isOwner = 0;
      var topicInfo = {};
      topicInfo.topicHash = "";
      topicInfo.desc = "系统提示：网络好像开小差了，请稍后重试！";
      topicInfo.award = 0;
      topicInfo.status = 0;
      topicInfo.owner = "";
      topicInfo.duration = 60;
      topicArr.push(topicInfo);
      responseRes.topicArr = topicArr;
      resolve(responseRes);
    }
    

  });

}

// 创建回答 
export var createSubTopic = async function (topicHash, desc, userAddr, pwd, keystore, subChainAddr, rpcIp) {

  var rpcIp = getRpcIp();

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
      
      var descEncode = AsciiToUnicode(desc);  
      createSubTopicSol(userAddr, pwd, descEncode, subChainAddr, topicHash, nonce, privatekey);
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
	
}

// 回答列表  (返回subTopicHash, desc, owner, voteCount)
// 先校验问题是否过期
//1 根据topicHash，查找回答hash数组  2 遍历获取到下标，根据下标查找所有回答
export var getSubTopicList = function (topicHash, pageNum, pageSize, subChainAddr, rpcIp, type, deployLwSolAdmin, userAddr) {
  // 校验问题是否过期
  var chain3 =  getChain3();
  var rpcIp = getRpcIp();
  var isOwner = 0;
  var responseRes = {};
  var subTopicArr = []
  return new Promise((resolve) => { 
    try {
      checkTime (subChainAddr, topicHash,rpcIp,topicIndex).then ((data) => {
        if (data == 0 && type == 1) {  
          responseRes.isEnable = 0;
          responseRes.isOwner = isOwner;
          responseRes.subTopicList = [];
          resolve(responseRes);  // 问题已经过期
        } else {
          var postParam1 = {
            "SubChainAddr": subChainAddr,
            "Sender": deployLwSolAdmin,
            "Data": config.lwAbi
          };
          getContractInfo(rpcIp, "ScsRPCMethod.SetDappAbi", postParam1).then(function(result){
            if (result == "success") {
              // 获取列表
              var postParam2 = {
                "SubChainAddr": subChainAddr,
                "Sender": deployLwSolAdmin,
                "Params": ["getSubTopicList", topicHash, config.pageNum, config.pageSize]
              };
              getContractInfo(rpcIp,"ScsRPCMethod.AnyCall", postParam2).then(function(subTopicList){
                getBoardOwner(rpcIp, subChainAddr, deployLwSolAdmin).then((ownerAddr) => {
                  if (userAddr == ownerAddr) {
                    isOwner = 1;
                  }
                  if (subTopicList == "" || subTopicList == null || subTopicList == undefined){
                    responseRes.isEnable = 1;
                    responseRes.isOwner = isOwner;
                    responseRes.subTopicList = [];
                    resolve(responseRes);
                  }
                  //subTopicList = subTopicList.replace(/\n/g, "-456")
                  var listObj = JSON.parse(subTopicList);
                  listObj.forEach(function (item, index) {
                      var subTopicInfo = {};
                      subTopicInfo.subTopicHash = "0x" + item.Hash;
                      //subTopicInfo.desc = item.Desc.replace(/-456/g, "\n");
                      var descValue = UnicodeToAscii(item.Desc);
                      if (descValue == "") {
                        subTopicInfo.desc = item.Desc;//.replace(/-456/g, "\n");
                      } else {
                        subTopicInfo.desc = descValue;
                      }
                      subTopicInfo.owner = "0x" + item.Owner;
                      subTopicInfo.reward = chain3.fromSha(item.Reward, "mc");
                      subTopicInfo.voteCount = item.VoteCount;
                      subTopicInfo.status = item.Status;
                      if (subTopicInfo.status == 1) {
                        subTopicInfo.desc = config.sensitiveInfo;
                      }
                      subTopicArr.push(subTopicInfo);
                    
                  });
                  responseRes.isEnable = 1;
                  responseRes.isOwner = isOwner;
                   responseRes.subTopicList = subTopicArr.sort(compareByCount);  // 点赞数倒序
                   resolve(responseRes);
  
                });
                
      
              });
            }
          });
  
        }
      });
    } catch (e) {
        responseRes.isEnable = 1;
        responseRes.isOwner = 0;
        var subTopicInfo = {};
  
        subTopicInfo.subTopicHash = "";
        subTopicInfo.desc = "系统提示：网络好像开小差了，请稍后重试！";
        subTopicInfo.owner = "";
        subTopicInfo.voteCount = 0;
        subTopicInfo.reward = 0;
        subTopicArr.push(subTopicInfo);
  
        responseRes.subTopicList = subTopicArr;
        resolve(responseRes);
    }
    
  
});
	
}


// 查询子链token余额 
export var getMicroChainBalance = function (userAddr, pwd, keystore, subChainAddr, rpcIp) {
  var rpcIp = getRpcIp();

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
  var rpcIp = getRpcIp();

  var result = {};
  var privatekeyObj = await decrypt(keystore, pwd);
  var privatekey = privatekeyObj.privateKey + "";
  try {
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

}

// autoCheck
export var autoCheck = async function (userAddr, pwd, keystore, subChainAddr, rpcIp) {

  var rpcIp = getRpcIp();
  var privatekeyObj = await decrypt(keystore, pwd);
  var privatekey = privatekeyObj.privateKey + "";

  var nonce = await currentNonce(subChainAddr, userAddr, rpcIp);
  autoCheckSol(userAddr, pwd, subChainAddr, nonce, privatekey);
  return 1;
  
}

// 我的链问列表
export var myTopicList = function (userAddr, subChainAddr, pwd,keystore, rpcIp, deployLwSolAdmin) {

  
  return new Promise ((resolve) => {

    var chain3 =  getChain3();
    var rpcIp = getRpcIp();
    var finalArr = [];

    try {
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
          //var topicList = topicList.replace(/\n/g, "-456");  // 换行符
          var topicArr = JSON.parse(topicList);
          
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
              
              //myTopic.desc = topicArr[key].Desc.replace(/-456/g, "\n");
              var descValue = UnicodeToAscii(topicArr[key].Desc);
              if (descValue == "") {
                myTopic.desc = topicArr[key].Desc;//.replace(/-456/g, "\n");
              } else {
                myTopic.desc = descValue;
              }
            }
            
            finalArr.push(myTopic);
          }
          resolve(finalArr);
            
          
        });
      }
    });
    } catch (e) {
      console.log("获取我的链问列表失败-------");

      var topicInfo = {};
      topicInfo.topicHash = "";
      topicInfo.desc = "系统提示：网络好像开小差了，请稍后重试！";
      topicInfo.award = 0;
      topicInfo.status = 0;
      topicInfo.owner = "";
      topicInfo.duration = 60;
      finalArr.push(topicInfo);
      resolve(finalArr);
    }
    
  });   
}

// 获取批量中文名称（暂不用）
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

export var getBoardList = function () {
  
  return new Promise ((resolve) => {
    commonSetVnode().then((data) => {
      chain3 = getChain3();
      var dechatmanagementaddr = config.manageSolAddress;
      var dechatmanagementAbi= config.dechatmanagementAbi;
      var dechatmanagementContract=chain3.mc.contract(JSON.parse(dechatmanagementAbi));
      var dechatmanagement=dechatmanagementContract.at(dechatmanagementaddr);

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
        resolve(boardList);
      });
    });
    
  });   
}

// 获取主链，子链当前区块高度，下一轮flush剩余区块数
export var getBlockInfo = function (subChainAddr, rpcIp) {
  return new Promise((resolve) => {
    var chain3 =  getChain3();
    var rpcIp = getRpcIp();

    var blockInfo = {};
    // 主链高度
    chain3.mc.getBlockNumber(function (err, blockNumber) {
      
      blockInfo.blockNumber = blockNumber;   // 主链高度

      var postParam1 = { "SubChainAddr": subChainAddr };
      getContractInfo(rpcIp, "ScsRPCMethod.GetBlockNumber", postParam1).then(function (subBlockNumber) {
        blockInfo.subBlockNumber = subBlockNumber;  // 子链高度
        var subchainInstance = getInstance(subChainAddr);

        subchainInstance.getFlushInfo(function (err, flushNumber) {
          blockInfo.flushNumber = flushNumber;  // 下一轮flush剩余区块数
          resolve(blockInfo);
        });
      });
    });

  });

}

export var updateContentStatus = async function (userAddr, pwd, keystore, subChainAddr, rpcIp, hash, status, type) {
  var flag = 0
  if (type == 1) {
    flag = updateTopicStatus(userAddr, pwd, keystore, subChainAddr, rpcIp, hash, status);
  } else if (type == 2) {
    flag = updateSubTopicStatus(userAddr, pwd, keystore, subChainAddr, rpcIp, hash, status);
  }
  return flag;
}

// 更新问题状态
export var updateTopicStatus = async function (userAddr, pwd, keystore, subChainAddr, rpcIp, topicHash, status) {

  var privatekeyObj = await decrypt(keystore, pwd);
  var privatekey = privatekeyObj.privateKey + "";
  var rpcIp = getRpcIp();
  var flag = 1;
  try{
      var nonce = await currentNonce(subChainAddr, userAddr, rpcIp);
      setTopicStatusSol(userAddr, pwd, subChainAddr, nonce, privatekey, topicHash, status);
      console.log("更新问题状态成功");
    } catch (e) {
      console.log("更新问题状态发生异常-----" + e);
      flag = 0;
    }
    return flag;
}

// 更新回答状态
export var updateSubTopicStatus = async function (userAddr, pwd, keystore, subChainAddr, rpcIp, subTopicHash, status) {

  var privatekeyObj = await decrypt(keystore, pwd);
  var privatekey = privatekeyObj.privateKey + "";
  var rpcIp = getRpcIp();
  var flag = 1;
  try{
      var nonce = await currentNonce(subChainAddr, userAddr, rpcIp);
      setSubTopicStatusSol(userAddr, pwd, subChainAddr, nonce, privatekey, subTopicHash, status);
      console.log("更新回答状态成功");
    } catch (e) {
      console.log("更新回答状态发生异常-----" + e);
      flag = 0;
    }
    return flag;
}

// 获取当前版块版主
export var getBoardOwner = async function (rpcIp, subChainAddr, deployLwSolAdmin) {
  return new Promise ((resolve) => {
    var postParam3 = {
      "SubChainAddr": subChainAddr,
      "Sender": deployLwSolAdmin,
      "Params": ["getDechatInfo"]
    };
    getContractInfo(rpcIp,"ScsRPCMethod.AnyCall", postParam3).then(function(result){
      resolve("0x" + JSON.parse(result)[0]);
      
    });
  }); 

}

// 获取最大时间，每个区块打包需要时间
export var getMaxTimeAndPerTime = async function (subChainAddr, deployLwSolAdmin) {
  var rpcIp = getRpcIp();
  return new Promise ((resolve) => {
    var timeInfo = {};
    var postParam3 = {
      "SubChainAddr": subChainAddr,
      "Sender": deployLwSolAdmin,
      "Params": ["getExpBlk"]
    };

    var postParam1 = {
      "SubChainAddr": subChainAddr,
      "Sender": deployLwSolAdmin,
      "Data": config.lwAbi
    };
    getContractInfo(rpcIp, "ScsRPCMethod.SetDappAbi", postParam1).then(function(result){

      getContractInfo(rpcIp, "ScsRPCMethod.AnyCall", postParam3).then(function(maxBlk){
        timeInfo.perTime = config.packPerBlockTime;
        timeInfo.maxTime = JSON.parse(maxBlk)[0] * timeInfo.perTime;
        resolve(timeInfo);
        
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
    var start = new Date().getTime();
    chain3 = getChain3();
    //var rpcIp = getRpcIp();
    return new Promise ((resolve) => {
      try {
        var postParam = {"SubChainAddr": subChainAddr, "Sender": userAddr};
        chain3.mc.getBlockNumber(function(err, num) {
          getContractInfo(rpcIp, "ScsRPCMethod.GetNonce", postParam).then(function(nonce){
            blockNumber = num;
            myNonce = nonce;
            var end = new Date().getTime();
            console.log("setNonce接口调用耗时为：");
            console.log((end-start)/1000);
                
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
  var chain3 =  getChain3();
  var rpcIp = getRpcIp();

  // cache和rpc的blockNumber相等，则继续nonce++，  不等则获取getNonce，传最新的出去
  var postParam = {"SubChainAddr": subChainAddr, "Sender": userAddr};
  
  var num = await new Promise((resolve) => {
    chain3.mc.getBlockNumber(function(err, blockNum) {
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
  
}

// 根据nonce获取操作结果（暂不用，针对提问，回答，点赞）
export var getResult = function (subChainAddr, userAddr, nonce, rpcIp){
  return new Promise ((resolve) => {
      var rpcIp = getRpcIp();

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

// Ascii转Unicode
function AsciiToUnicode(content) {
	result = '';
	for (var i=0; i<content.length; i++)
	result+='&#' + content.charCodeAt(i) + ';';
	return result;
}

// Unicode转Ascii
function UnicodeToAscii(content) { 
  var code = content.match(/&#(\d+);/g);
  if (code == null || code == undefined) {
    return "";
  }
	result= '';
	for (var i=0; i<code.length; i++)
	result += String.fromCharCode(code[i].replace(/[&#;]/g, ''));
	return result;
}

// 批量点赞
// export function approveSubTopics() {
//   getSubTopics().then((data) => {
//     var arr1 = arrInfo.arr1;
//     var arr2 = arrInfo.arr2;
//     for ()
//   });
// }

// 批量创建问题
export function createManyTopics () {
  return new Promise ((data) => {
    for (var i = 1; i <= 3; i++) {
      createTopic(1, getCurrentTime() + "--第"+ i + "个问题？", 300, 
      config.userAddr2, config.pwd, keystore_myTest, config.subChainAddr, "").then((data) => {
        if (i == 3) {
          resolve(1);
        }
      });
     
    }
  });
  
}

// 批量创建回答
export function createManySubTopics () {
  getTopicList(0,0, config.subChainAddr, "", "0x44c10f4cd26dbb33b0cc3bd8d9fb4e313498cfa0", config.userAddr2).then((data) => {
    data.topicArr.forEach(function (item, index) {
        for(var i = 1; i <= 5; i++) {
          createSubTopic(item.topicHash, 
            getCurrentTime() + "--第"+ i + "个回答", config.userAddr2, config.pwd, keystore_myTest, config.subChainAddr, "").then((data) => {
            console.log("-----------" + data);
          });
        }
        
    });
  });
}
              


// 批量点赞
export function approveSubTopics() {
  return new Promise ((resolve) => {
    getSubTopics().then((arrInfo) => {
      console.log("----------" + arrInfo);
      var voteArr1 = arrInfo.arr1;
      var voteArr2 = arrInfo.arr2;
    
      vote1(voteArr1).then((data1) => {
        if (data1 == 1) {
          vote2(voteArr2).then((data2) => {
            if (data2 == 1) {
              vote3(voteArr3).then((data3) => {
                if (data3 == 1) {
                  resolve(1);
                }
        
              });
            }
    
          });
        }
      })
    
    });
  });
}



export function getSubTopics() {
  return new Promise ((resolve) => {
    getTopicList(0,0, config.subChainAddr, "", "0x44c10f4cd26dbb33b0cc3bd8d9fb4e313498cfa0", config.userAddr2).then((data1) => {

      console.log("=============" +data1);
      var arr1 = [];
      var arr2 = [];
      var flag = 0;
      var arrInfo = {};
      data1.topicArr.forEach(function (item, index) {
          
          getSubTopicList(item.topicHash,
           0,0, config.subChainAddr,"", 1, config.deployLwSolAdmin, config.userAddr2).then((data2) => {
           console.log(data2);

            flag ++;
            if (data2.subTopicList.length > 0) {
              arr1.push(data2.subTopicList[0].subTopicHash);
            arr2.push(data2.subTopicList[1].subTopicHash);
            if (flag == data1.topicArr.length) {
              arrInfo.arr1 = arr1;
              arrInfo.arr2 = arr2;
              resolve (arrInfo);
            }
            }
            


          });
          
      });
    
    });
  });
  
}


// user1投票第一个评论数组
function vote1 (voteArr1) {
  commonSetRpcAndVnode(config.subChainAddr, config.rpcIp).then((data) => {
    setNonce(config.subChainAddr, config.userAddr1, data.rpcIp).then((data) => {
      return new Promise ((resolve) => {
        var flag = 0;
        voteArr1.forEach(function (item) {
          approveSubTopic(config.userAddr1, item.subTopicHash, config.subChainAddr,
            config.pwd, config.keystore_youTest, "").then((data) => {
              flag ++;
              if (flag == voteArr1.length) {
                resolve(1);
              }
            });
        });
    
      });

    });
    });
  
  
}

// user2投票第一个评论数组
function vote2 (voteArr2) {
  commonSetRpcAndVnode(config.subChainAddr, config.rpcIp).then((data) => {
    setNonce(config.subChainAddr, config.userAddr2, data.rpcIp).then((data) => {
      return new Promise ((resolve) => {
        var flag = 0;
        voteArr2.forEach(function (item) {
          approveSubTopic(config.userAddr2, item.subTopicHash, config.subChainAddr,
            config.pwd, config.keystore_myTest, "").then((data) => {
              flag ++;
              if (flag == voteArr2.length) {
                resolve(1);
              }
            });
        });
    
      });
    });
  });
  
  
}

// user3投票第二个评论数组
function vote3 (voteArr3) {
  commonSetRpcAndVnode(config.subChainAddr, config.rpcIp).then((data) => {
    setNonce(config.subChainAddr, config.userAddr4, data.rpcIp).then((data) => {
      return new Promise ((resolve) => {
        var flag = 0;
        voteArr3.forEach(function (item) {
          approveSubTopic(config.userAddr4, item.subTopicHash, config.subChainAddr,
            config.pwd, config.keystore_ownerTest, "").then((data) => {
              flag ++;
              if (flag == voteArr3.length) {
                resolve(1);
              }
            });
        });
    
      });

    });
  });
  
  
}
 
