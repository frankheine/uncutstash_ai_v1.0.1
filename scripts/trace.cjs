const fs = require('fs');
const potrace = require('potrace');
const path = require('path');

const imagePath = path.join(__dirname, '../public/logos/UNCUTstash_Logo_512.png');

potrace.trace(imagePath, { color: '#ffffff', optTolerance: 0.2 }, function(err, svg) {
  if (err) {
    console.error("Error tracing image:", err);
    process.exit(1);
  }
  fs.writeFileSync(path.join(__dirname, '../public/uncut-trace.svg'), svg);
  console.log("Successfully traced UNCUTstash logo to public/uncut-trace.svg");
});
