var utils = require('../utils.js');
//
// Encrypts a ciphertext using single char XOR with unknown key
//
// Buffer, Buffer -> Buffer
//
function encrypt(bufPt, bufKey) {
  var bufCt  = new Buffer(bufPt.length);
  var keyLen = bufKey.length;

  for (var i = 0; i < bufPt.length; i++) {
    bufCt[i] = bufPt[i] ^ bufKey[i % keyLen];
  }

  return bufCt;
}

exports.encrypt = encrypt;