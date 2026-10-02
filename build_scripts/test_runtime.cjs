const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('ara_dataflow_motion_graphic.html', 'utf8');

// Parse DOM IDs from HTML
const idRegex = /id=["']([^"']+)["']/g;
const domElements = {};
let match;
while ((match = idRegex.exec(html)) !== null) {
  const id = match[1];
  domElements[id] = {
    id: id,
    tagName: 'DIV',
    style: {},
    classList: {
      _classes: new Set(),
      add: function(...c) { c.forEach(x => this._classes.add(x)); },
      remove: function(...c) { c.forEach(x => this._classes.delete(x)); },
      toggle: function(c, force) {
        if (force === undefined) {
          if (this._classes.has(c)) this._classes.delete(c);
          else this._classes.add(c);
        } else if (force) this._classes.add(c);
        else this._classes.delete(c);
      },
      contains: function(c) { return this._classes.has(c); }
    },
    dataset: {},
    children: [],
    childNodes: [],
    appendChild: function(c) { this.children.push(c); },
    removeChild: function(c) {
      const idx = this.children.indexOf(c);
      if (idx > -1) this.children.splice(idx, 1);
    },
    setAttribute: function(k, v) { this[k] = v; },
    getAttribute: function(k) { return this[k]; },
    removeAttribute: function(k) { delete this[k]; },
    addEventListener: function(evt, fn) {},
    removeEventListener: function(evt, fn) {},
    focus: function() {},
    click: function() {},
    scrollTop: 0,
    scrollHeight: 100,
    clientWidth: 1280,
    clientHeight: 720,
    width: 1280,
    height: 720,
    getContext: function(type) {
      if (type === '2d') {
        return new Proxy({}, {
          get: (target, prop) => {
            if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
              return () => ({ addColorStop: () => {} });
            }
            return (...args) => {};
          },
          set: () => true
        });
      }
      return null;
    }
  };
}

// Global context mock
const sandbox = {
  console: console,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  setInterval: setInterval,
  clearInterval: clearInterval,
  requestAnimationFrame: function(cb) {
    // don't loop forever, just register
    return 1;
  },
  cancelAnimationFrame: function(id) {},
  window: {
    innerWidth: 1280,
    innerHeight: 720,
    devicePixelRatio: 1,
    addEventListener: function(evt, fn) {},
    removeEventListener: function(evt, fn) {},
    print: function() {},
    location: { href: '' }
  },
  document: {
    addEventListener: function(evt, fn) {},
    removeEventListener: function(evt, fn) {},
    documentElement: {
      style: {
        setProperty: () => {},
        getPropertyValue: () => ''
      },
      requestFullscreen: () => {}
    },
    body: {
      classList: {
        _classes: new Set(),
        add: function(...c) { c.forEach(x => this._classes.add(x)); },
        remove: function(...c) { c.forEach(x => this._classes.delete(x)); },
        toggle: function(c, force) {
          if (force === undefined) {
            if (this._classes.has(c)) this._classes.delete(c);
            else this._classes.add(c);
          } else if (force) this._classes.add(c);
          else this._classes.delete(c);
        },
        contains: function(c) { return this._classes.has(c); }
      },
      dataset: {},
      appendChild: () => {},
      removeChild: () => {}
    },
    getElementById: function(id) {
      return domElements[id] || null;
    },
    querySelectorAll: function(sel) {
      return [];
    },
    querySelector: function(sel) {
      return null;
    },
    createElement: function(tag) {
      return {
        tagName: tag.toUpperCase(),
        style: {
          setProperty: () => {}
        },
        dataset: {},
        classList: { add: ()=>{}, remove: ()=>{}, contains: ()=>false, toggle: ()=>{} },
        setAttribute: ()=>{},
        getAttribute: ()=>{},
        addEventListener: ()=>{},
        appendChild: ()=>{},
        click: ()=>{}
      };
    }
  },
  localStorage: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
  },
  URL: {
    createObjectURL: () => 'blob:mock',
    revokeObjectURL: () => {}
  },
  Blob: function() {}
};

sandbox.window.document = sandbox.document;
sandbox.self = sandbox.window;
sandbox.global = sandbox;

const jsStart = html.indexOf('<script>') + '<script>'.length;
const jsEnd = html.lastIndexOf('</script>');
const jsCode = html.substring(jsStart, jsEnd);

console.log('Running bundle in sandbox...');
try {
  vm.createContext(sandbox);
  vm.runInContext(jsCode, sandbox);
  console.log('SUCCESS: Script ran without runtime errors!');
  console.log('SCENES count:', sandbox.SCENES ? sandbox.SCENES.length : 'undefined');
  console.log('NODES count:', sandbox.NODES ? sandbox.NODES.length : 'undefined');
  console.log('EDGES count:', sandbox.EDGES ? sandbox.EDGES.length : 'undefined');
} catch (err) {
  console.error('RUNTIME ERROR:', err);
  process.exit(1);
}
