'use strict';

const uuidv4 = require('uuid/v4');

const Blockchain = require('./blockchain.js')
const blockchain = new Blockchain();

const express = require('express');
const bodyParser = require('body-parser');
const app = express();
app.use(bodyParser.json());

// Generate a globally unique address for this node
const nodeIdentifier = uuidv4().replace(/-/g, '');

app.get('/mine', (req, res) => {
  // We run the proof of work algorithm to get the next proof...
  const lastBlock = blockchain.lastBlock;
  const lastProof = lastBlock['proof'];
  const proof = Blockchain.proofOfWork(lastProof);

  // We must receive a reward for finding the proof.
  // The sender is "0" to signify that this node has mined a new coin.
  blockchain.newTransaction({
    'sender': '0',
    'recipient': nodeIdentifier,
    'amount': 1
  });

  // Forge the new Block by adding it to the chain
  const previousHash = Blockchain.hash(lastBlock);
  const block = blockchain.newBlock(proof, previousHash)

  res.send({
    'message': 'New Block Forged',
    'index': block['index'],
    'transactions': block['transactions'],
    'proof': block['proof'],
    'previous_hash': block['previous_hash']
  }, 200)
});


app.post('/transactions/new', (req, res) => {
  const [sender, recipient, amount] = [req.body['sender'], req.body['recipient'], req.body['amount']]
  const index = blockchain.newTransaction(sender, recipient, amount)

  res.send({'message': 'Transaction will be added to Block ' + index}, 201)
});


app.get('/chain', (req, res) => {
  res.send({
    'chain': blockchain.chain,
    'length': blockchain.chain.length
  })
});


app.post('/nodes/register', (req, res) => {
  const nodes = req.body['nodes'];

  if (nodes === undefined) {
    res.send({'message': 'Error: lease supply a valid list of nodes'}, 400);
    return;
  }

  nodes.forEach((node) => {
    blockchain.registerNode(node);
  })

  res.send({
    'message': 'New nodes have been added',
    'totalNodes': blockchain.nodes,
  })
});


app.get('/nodes/resolve', async (req, res) => {
  if (await blockchain.resolveConflicts()) {
    res.send({
      'message': 'Our chain was replaced',
      'newChain': blockchain.chain
    })
  } else {
    res.send({
      'message': 'Our chain is authoritative',
      'chain': blockchain.chain
    })
  }
})


const port = parseInt(process.argv[2]) || 3000;
app.listen(port, () => {
  console.log(`Example app listening on port ${port}!`);
});
