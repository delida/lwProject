pragma solidity ^0.4.19;
pragma experimental ABIEncoderV2;
//David Chen
//Dapp Dechat

contract DappBase {
	struct RedeemMapping {
        address[] userAddr;
        uint[] userAmount;
        uint[] time;
    }
    
    struct Task{
        bytes32 hash;
        address[] voters;
        bool distDone;
    }
    
    mapping(uint => RedeemMapping) internal redeem;
    address[] public curNodeList;//
    mapping(bytes32=>Task) task;
    mapping(bytes32=>address[]) nodeVoters;
    address internal owner;
    
	function DappBase() public payable {
		owner = msg.sender;
	}
	
	function redeemFromMicroChain() public payable {//The user takes the coin to the main chain erc20
        redeem[block.number].userAddr.push(msg.sender);
        redeem[block.number].userAmount.push(msg.value);
        redeem[block.number].time.push(now);
    }
    
    function have(address[] addrs, address addr) public view returns (bool) {
        uint i;
        for (i = 0; i < addrs.length; i++) {
            if(addrs[i] == addr) {
                return true;
            }
        }
        return false;
    }
    
    function updateNodeList(address[] newlist) public {
        //if owner, can directly update
        if(msg.sender==owner) {
            curNodeList = newlist;
        }
        //count votes
        bytes32 hash = sha3(newlist);
        bytes32 oldhash = sha3(curNodeList);
        if( hash == oldhash) return;
        
        bool res = have(nodeVoters[hash], msg.sender);
        if (!res) {
            nodeVoters[hash].push(msg.sender);
            if(nodeVoters[hash].length > newlist.length/2) {
                curNodeList = newlist;
            }
        }
        
        return;
    }
    
    function postFlush(bytes32 flushhash, address[] tosend, uint[] amount) public { //tosend is array of [blk,add,amt]
        require(have(curNodeList, msg.sender));
        require(tosend.length == amount.length);
        
        bytes32 hash = sha3(flushhash, tosend, amount);
        if( task[hash].distDone) return;
        if(!have(task[hash].voters, msg.sender)) {
            task[hash].voters.push(msg.sender);
            if(task[hash].voters.length > curNodeList.length/2 ) {
                //distribute
                task[hash].distDone = true;
                for(uint i=0; i<tosend.length; i++ ) {
                    tosend[i].transfer(amount[i]);
                }
            }
        }
    }
}

contract DeChat is DappBase{
	struct topic {
		bytes32 hash;
		address owner;
		string desc;
		uint award;
		uint startblk;
		uint expblk;
		uint bestVoteCount;
		bytes32 bestHash;
		uint secondBestVoteCount;
		bytes32 secondBestHash;
		bool closed;
		uint status;
	}

	struct subTopic {
		bytes32 hash;
		address owner;
		string desc;
		uint reward;
		bytes32 parent;
		uint voteCount;
		address[] voters;
		uint status;
	}
	
	mapping(bytes32 => topic) public topics;
	mapping(bytes32 => subTopic) public subTopics;
	mapping(bytes32 => bytes32[]) public topicAns; // main topic => [ans1, ans2,...]
	mapping(uint => bytes32[]) public expinfo;
	mapping(bytes32 => uint) public voteinfo; // (address,topichash) => 0,1
	bytes32[] public newTopicList;
	mapping(bytes32 => uint ) newTopicIndex;
	uint public lastProcBlk;
	uint public answerBond = 10 ** 17; // 0.1
	uint public firstPrize = 50; //
	uint public secondPrize = 20; //
	uint public votePrize = 20; //
	uint public modPrize = 9;
	uint public devPrize = 1; 
	uint public voteAwardCount = 100; //only first 100 voter get reward
	uint public maxExpBlk = 50;
	
	address internal owner;
	address internal developer;
	address internal moderator;
	
	mapping(address => topic[]) public myTopics; // index = 0x18
	
	uint private maxVotes = 100;// autoCheck max handle votes of one subTopic
	uint private maxTopics = 100;// autoCheck max handle Topics of one block

	function DeChat(address mod, address dev) public payable {
		lastProcBlk = block.number;
		owner = msg.sender;
		moderator = mod;
		developer = dev;
	}	

	function createTopic(uint award, uint expblk, string desc) public payable returns (bytes32) {
		require(msg.value >= award );
		bytes32 hash = sha3(block.number, msg.sender, desc);
		topics[hash].hash = hash;
		topics[hash].owner = msg.sender;
		topics[hash].award = award;
		if( expblk < maxExpBlk) {
			topics[hash].expblk = expblk;
		} else {
			topics[hash].expblk = maxExpBlk;
		}
		topics[hash].startblk = block.number;
		topics[hash].desc = desc;
		topics[hash].closed = false;
		topics[hash].status = 0;
		//add loop value
		expinfo[block.number + expblk].push(hash);
		newTopicIndex[hash]=newTopicList.length;
		newTopicList.push(hash);

		myTopics[msg.sender].push(topics[hash]);
		return hash;
	}
	
	function voteOnTopic(bytes32 topichash) public returns(bytes32) {
		require(subTopics[topichash].hash != "");
		bytes32 parenthash = subTopics[topichash].parent;
		require(parenthash != "" );
		//key is (topic, msg.sender)
		bytes32 key = sha3(msg.sender, parenthash);
		if (voteinfo[key] >= 1){
		    return bytes32(0);
		}
		//mark as voted
		voteinfo[key] = 1;
		//add to voters
		subTopics[topichash].voteCount ++;

		if(subTopics[topichash].voteCount < voteAwardCount ) {
			subTopics[topichash].voters.push(msg.sender);
		}

		if( subTopics[topichash].voteCount > topics[parenthash].bestVoteCount ) {
			//swap best and secnd best
			topics[parenthash].secondBestHash = topics[parenthash].bestHash;
			topics[parenthash].secondBestVoteCount = topics[parenthash].bestVoteCount;
			topics[parenthash].bestHash = topichash;
			topics[parenthash].bestVoteCount = subTopics[topichash].voteCount;
			updateMyTopic(topics[parenthash]);
			return key;
		}

		if( subTopics[topichash].voteCount > topics[parenthash].secondBestVoteCount ) {
			//replace secnd best
			topics[parenthash].secondBestHash = topichash;
			topics[parenthash].secondBestVoteCount = subTopics[topichash].voteCount;
			updateMyTopic(topics[parenthash]);
			return key;
		}
		
		return key;
	}
	
	function creatSubTopic(bytes32 parenthash, string desc) public returns (bytes32) {
		//require(msg.value >= answerBond );
		bytes32 hash = sha3(block.number, msg.sender, desc);
		//save subtopic
		subTopics[hash].hash = hash;
		subTopics[hash].owner = msg.sender;
		subTopics[hash].desc = desc;
		subTopics[hash].reward = 0;
		subTopics[hash].parent = parenthash;
		subTopics[hash].status = 0;
		//add to ans list
		topicAns[parenthash].push(hash);
		return hash;
	}
	
	function updateMyTopic(topic t) private{
		require(t.owner != address(0));
			
        for (uint i=0; i < myTopics[t.owner].length; i++) {
			if (t.owner == myTopics[t.owner][i].owner && t.hash == myTopics[t.owner][i].hash) {
				myTopics[t.owner][i] = t;
			}
		}
	}
	
	function getMyTopic(address addr) public view returns (topic[]){
		require(addr != address(0));
		
		return myTopics[addr];
	}
	
	function setTopicStatus(bytes32 hash, uint status)  public returns(bytes32) {
		require(owner == msg.sender || moderator ==  msg.sender);
		require(hash != bytes32(0));

		topics[hash].status = status;
		topic t = topics[hash];
		updateMyTopic(t);
		return hash;
	}

	function setSubTopicStatus(bytes32 hash, uint status)  public returns(bytes32) {
		require(owner == msg.sender || moderator ==  msg.sender);
		require(hash != bytes32(0));

		subTopics[hash].status = status;
		return hash;
	}

	function autoCheck() public {
		require ( lastProcBlk < block.number );
		uint rewardback = 0;
		uint i=0;
		for(i=lastProcBlk; i<block.number; i++ ) {
			for( uint j=0; j<expinfo[i].length && j<maxTopics; j++ ) {
				bytes32 phash = expinfo[i][j];
				if(phash == "" || topics[phash].closed) {
				continue;
				}

                rewardback = topics[phash].award;

				//best topic
				bytes32 besthash = topics[phash].bestHash;
				if(subTopics[besthash].owner != address(0) ){
					uint reward1 = topics[phash].award * firstPrize /100;
					subTopics[besthash].owner.transfer(reward1);
					subTopics[besthash].reward = reward1;

                    rewardback = rewardback - reward1;
				}

				//award top 100 voter for besthash
		                maxVotes = subTopics[besthash].voters.length;
		                if (maxVotes > 100) {
		                    maxVotes = 100;
		                }

				for( uint k=0; k<maxVotes; k++ ) {
                    uint rewardv = topics[phash].award * votePrize /100/maxVotes;
					subTopics[besthash].voters[k].transfer(rewardv);

                    rewardback = rewardback - rewardv;
				}
				
				//second best topic
				bytes32 secondBesthash = topics[phash].secondBestHash;
				if(subTopics[secondBesthash].owner != address(0) ){
					uint reward2 = topics[phash].award * secondPrize /100;
					subTopics[secondBesthash].owner.transfer(reward2);
					subTopics[secondBesthash].reward = reward2;

                    rewardback = rewardback - reward2;
				}

				// award moderator
				if(moderator != address(0) ){
				    uint t = topics[phash].award * modPrize /100;
					moderator.transfer(t);

                    rewardback = rewardback - t;
				}

				// award developer
				if(developer != address(0) ){
					developer.transfer( topics[phash].award * devPrize /100 );

                    rewardback = rewardback -  topics[phash].award * devPrize /100;
				}

		        // pay back to owner if remain
		        if (rewardback > 0) {
		            topics[phash].owner.transfer(rewardback);
                }

				//mark as closed
				topics[phash].closed = true;
				updateMyTopic(topics[phash]);
				//swap with last one
				bytes32 last = newTopicList[newTopicList.length -1 ];
				uint cur = newTopicIndex[phash];
				newTopicList[cur] = last;
				newTopicIndex[last] = cur;
				newTopicList.length --;
				delete newTopicIndex[phash];
			}
		}
		if (i>0) {
			lastProcBlk = i-1;
		}
	}
}