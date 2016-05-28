var path = require('path');
var ContextElementDependency = require('webpack/lib/dependencies/ContextElementDependency');
var resolveTemplates = require('./resolve-template');

class AureliaWebpackPlugin {
  constructor(options = {}) {
    options.root = options.root || path.dirname(module.parent.filename);
    options.src = options.src || path.resolve(options.root, 'src');
    options.resourceRegExp = options.resourceRegExp || /aurelia-loader-context/;
    options.srcResolve = options.async ? 'bundle?lazy!' + options.src : options.src;

    this.options = options;
  }
  
  apply(compiler) {
    compiler.plugin('context-module-factory', cmf => {
      cmf.plugin('before-resolve', (result, callback) => {
        if (!result) return callback();
        if (this.options.resourceRegExp.test(result.request)) {
          if (typeof this.options.srcResolve !== 'undefined') {
            result.request = this.options.srcResolve;
          }
        }
        return callback(null, result);
      });
      cmf.plugin('after-resolve', (result, callback) => {
        if (!result) return callback();
        if (this.options.srcResolve.indexOf(result.resource, this.options.srcResolve.length - result.resource.length) !== -1) {
          const resolveDependencies = result.resolveDependencies;
          
          // substitute resolveDependencies method with an enhanced version:
          result.resolveDependencies = (fs, resource, recursive, regExp, callback) =>
            resolveDependencies(fs, resource, recursive, regExp, (error, dependencies) => {
              if (error) return callback(error);

              resolveTemplates.processAll(this.options).then(contextElements => {
                for (let requireRequestPath of Object.keys(contextElements).reverse()) {
                  let webpackRequestPath = contextElements[requireRequestPath];
                  let newDependency = new ContextElementDependency(webpackRequestPath, requireRequestPath);
                  newDependency.optional = true;
                  let previouslyAdded = dependencies.findIndex(dependency => dependency.userRequest === requireRequestPath);
                  if (previouslyAdded > -1) {
                    dependencies[previouslyAdded] = newDependency;
                  } else {
                    dependencies.push(newDependency);
                  }
                  // TODO: optional filtering of context (things we don't want to require)
                }
                
                return callback(null, dependencies);
              }, error => {
                console.error('Error processing templates', error.message);      
                return callback(error);
              });
            });
        }
        return callback(null, result);
      });
    });
  }
}

module.exports = AureliaWebpackPlugin;