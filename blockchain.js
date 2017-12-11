'use strict';

const crypto = require('crypto');
const request = require('request-promise');

class Blockchain {
  constructor() {
    this.chain = [];
    this.currentTransactions = [];
    this.nodes = new Set();

    this.newBlock(100, 1);
  }
  
  /**
   * Add a new node to the list of nodes
   * @param {string} address - Address of node. Eg. 'http://192.168.0.5:5000'
   */
  registerNode(address) {
    this.nodes.add(address);
  }

  /**
   * Create a new Block in the Blockchain
   * @param {number} proof - The proof given by the Proof of Work algorithm
   * @param {string} previousHash - Optional. Hash of previous Block.
   * @return {object} - New block
   */
  newBlock(proof, previousHash=undefined) {
    const block = {
      'index': this.chain.length + 1,
      'timestamp': new Date().valueOf(),
      'transactions': this.currentTransactions,
      'proof': proof,
      'previousHash': previousHash || Blockchain.hash(this.chain[-1])
    };

    // Reset the current list of transactions
    this.currentTransactions = [];

    //
    this.chain.push(block);
    return block;
  }

  /**
   * Creates a new transaction to go into the next mined Block
   * @param {string} sender - Address of the Sender
   * @param {string} recipient - Address of the Recipient
   * @param {number} amount - Amount
   * @return {number} - The index of the Block that will hold this transaction
   */
  newTransaction(sender, recipient, amount) {
    this.currentTransactions.push({
      'sender': sender,
      'recipient': recipient,
      'amount': amount
    });

    return this.lastBlock['index'] + 1;
  }

  /**
   * Returns the last Block in the chain
   * @return {object} - A block
   */
  get lastBlock() {
    return this.chain[this.chain.length - 1]
  }

  /**
   * Determine if a given blockchain is valid
   * @param {[object]} chain - A array of blocks
   * @return {boolean} - True if valid, false if not
   */
  static validChain(chain) {
    let lastBlock = chain[0];
    let currentIndex = 1;

    while (currentIndex < chain.length) {
      const block = chain[currentIndex];
      console.log(`${lastBlock}`);
      console.log(`${block}`);
      console.log('---------');

      // Check that the hash of the block is correct
      if (block['previousHash'] !== Blockchain.hash(lastBlock)) {
        return false;
      }

      // Check that the Proof of Work is correct
      if (Blockchain.validProof(lastBlock['proof'], block['proof']) === false) {
        return false;
      }

      lastBlock = block;
      currentIndex += 1;
    }
  }

  /**
   * This is our Consensus Algorithm, it resolves conflicts
   * by replacing our chain with the longest one in the network.
   * @return {Promise.<boolean>} - True if our chain was replaced, False if not
   */
  async resolveConflicts() {
    const neighbours = [...this.nodes];

    // Grab and verify the chains from all the nodes in our network
    const neighboursPromises = neighbours.map((node) => {
      const url = `${node}/chain`;

      return new Promise((resolve) => {
        request(url)
          .then((body) => {
            const json = JSON.parse(body);
            const length = json['length'];
            const chain = json['chain'];

            if (Blockchain.validChain(chain)) {
              resolve([length, chain])
            } else {
              resolve([0, []])
            }
          })
          .catch(() => {
            resolve([0, []])
          })
      })
    })

    const data = await Promise.all(neighboursPromises);
    data.reduce((a, c) => {
      if (a[0] > c[0]) {
        return a;
      } else {
        return c;
      }
    }, [this.chain.length, this.chain]);

    if (this.chain.length >= data[0][0]) {
      return false
    } else {
      this.chain = data[0][1];

      return true;
    }
  }

  /**
   * Creates a SHA-256 hash of a Block
   * @param {object} block - A block
   * @return {string} - A SHA-256 string
   */
  static hash(block) {
    // We must make sure that the Dictionary is Ordered, or we'll have inconsistent hashes
    const blockOrdered = {};
    Object.keys(block).sort().forEach((key) => {
      blockOrdered[key] = block[key];
    });

    const stringify = JSON.stringify(blockOrdered);
    return crypto.createHmac('sha256', stringify).digest('hex');
  }

  /**
   * Simple Proof of Work Algorithm:
   * - Find a number p' such that hash(pp') contains leading 4 zeroes, where p is the previous p'
   * - p is the previous proof, and p' is the new proof
   * @param {number} lastProof - Previous Proof
   * @return {number} - A valid proof
   */
  static proofOfWork(lastProof) {
    let proof = 0;
    while (Blockchain.validProof(lastProof, proof) === false) {
      proof += 1;
    }

    return proof;
  }

  /**
   * Validates the Proof: Does hash(last_proof, proof) contain 4 leading zeroes?
   * @param {number} lastProof - Previous Proof
   * @param {number} proof - Current Proof
   * @return {boolean} - True if correct, False if not.
   */
  static validProof(lastProof, proof) {
    const guess = `${lastProof}${proof}`;
    const guessHash = crypto.createHmac('sha256', guess).digest('hex');
    return guessHash.substr(guessHash.length - 4) === "0000";
  }
}

module.exports = Blockchain;