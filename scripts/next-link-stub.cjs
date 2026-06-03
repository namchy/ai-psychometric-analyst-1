const React = require("react");

function NextLinkStub({ href, children, ...props }) {
  return React.createElement("a", { href, ...props }, children);
}

module.exports = NextLinkStub;
