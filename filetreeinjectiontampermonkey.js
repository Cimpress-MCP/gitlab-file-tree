// ==UserScript==
// @name         Gitlab file tree
// @namespace    http://cimpress.io
// @version      1.0
// @description  Create a file tree for merge request diffs
// @author       Jimmy Anderson
// @match        https://cimpress.githost.io/*/merge_requests/*
// @grant        unsafeWindow
// @grant        GM_addStyle
// @updateURL https://static.designer.cimpress.io/gitlab-extensions/gitlab-file-tree.js
// @downloadURL https://static.designer.cimpress.io/gitlab-extensions/gitlab-file-tree.js
// ==/UserScript==

(function () {
  'use strict';

  console.log('Gitlab file tree user script started!');

  GM_addStyle(`
.gl-file-tree {
  border-top: 2px solid #e5e5e5;
  border-bottom: 2px solid #e5e5e5;
}

.gl-file-tree__heading {
  border-bottom: 2px solid #e5e5e5;
}

.gl-file-tree__tree-view {
  height: 475px;
  overflow: auto;
}

.gl-file-tree__tree-view ul {
margin: 0 0 0 8px;
padding: 0;
}

.gl-file-tree__folder--collapsed {
display: none;
}

.gl-file-tree__tree-view li {
margin: 0;
padding: 0;
list-style: none;
}

.gl-file-tree__folder {
cursor: pointer;
}

.gl-file-tree__icon {
margin-right: 4px;
}

.gl-file-tree__file--deleted {
text-decoration: line-through !important;
color: darkred !important;
}

.gl-file-tree__file--new {
color: green !important;
}

.gl-file-tree__file--new::after {
color: green;
content: '*';
}

.gl-file-tree__file--moved {

}

.gl-file-tree__file {
display: inline !important;
padding: 0 !important;
}

.gl-file-tree__tree-view::-webkit-scrollbar-track {
border-radius: 10px;
background-color: #ffffff;
}

.gl-file-tree__tree-view::-webkit-scrollbar {
width: 5px;
height: 5px;
background-color: #ffffff;
}

.gl-file-tree__tree-view::-webkit-scrollbar-thumb {
border-radius: 10px;
background-color: #e5e5e5;
}

.gl-file-tree__tree-view::-webkit-scrollbar-corner {
background: transparent;
}

`);

  const createElement = unsafeWindow.document.createElement.bind(unsafeWindow.document);


  function getFileInfo() {
      return Array
          .from(unsafeWindow.document.querySelectorAll('.files .diff-file.file-holder'))
          .map(node => {
              const anchor = node.querySelectorAll('.file-header-content a')[0];
              const titleNodes = anchor.getElementsByClassName('file-title-name');
              const lastTitle = titleNodes[titleNodes.length - 1];
              const isDeleted = Array.from(anchor.childNodes).some(child => child.nodeType === 3 && child.textContent.trim() === 'deleted');

              // A file is new if there is a <small> element in the header and it is not deleted
              const sizeChangeElement = node.querySelectorAll('.file-header-content small')[0];
              const isNew = sizeChangeElement && !isDeleted;

              return {
                  href: anchor.getAttribute('href'),
                  filePath: lastTitle.getAttribute('data-title'),
                  leaf: true,
                  referenceElement: node,
                  isDeleted,
                  isNew
              };
          });
  }

  function buildTree(fileInfo) {
      const pathTree = { path: '/' };

      fileInfo.forEach(info => {
          let root = pathTree;
          const pathItems = info.filePath.split('/');
          pathItems.forEach(item => {
              root.children = root.children || {};
              root.children[item] = root.children[item] || {};
              root = root.children[item];
              root.path = item;
          });

          Object.assign(root, info);
      });

      return pathTree;
  }

  function createIconElement(iconName) {
      const element = createElement('i');
      element.classList.add('fa', `fa-${iconName}`, 'gl-file-tree__icon');
      return element;
  }

  function createFolderElement(node) {
      const element = createElement('li');

      const nameWrapper = createElement('div');
      nameWrapper.classList.add('gl-file-tree__folder');

      const icon = createIconElement('folder-open');
      const name = createElement('span');
      name.textContent = node.path;

      nameWrapper.appendChild(icon);
      nameWrapper.appendChild(name);

      const list = createElement('ul');

      element.appendChild(nameWrapper);
      element.appendChild(list);

      const clickHandler = e => {
          e.stopPropagation();

          if (list.classList.contains('gl-file-tree__folder--collapsed')) {
              list.classList.remove('gl-file-tree__folder--collapsed');
              icon.classList.add('fa-folder-open');
              icon.classList.remove('fa-folder');
          } else {
              list.classList.add('gl-file-tree__folder--collapsed');
              icon.classList.remove('fa-folder-open');
              icon.classList.add('fa-folder');
          }
      };

      nameWrapper.addEventListener('click', clickHandler);

      return [element, list];
  }

  function createLeafElement(node) {
      const element = createElement('li');
      const icon = createIconElement('file-text-o');
      const anchor = createElement('a');
      anchor.href = node.href;
      anchor.textContent = node.path;
      anchor.classList.add('gl-file-tree__file');

      if (node.isDeleted) {
          anchor.classList.add('gl-file-tree__file--deleted');
      }

      if (node.isNew) {
          anchor.classList.add('gl-file-tree__file--new');
      }

      const clickHandler = e => {
          const clickToExpand = node.referenceElement.getElementsByClassName('click-to-expand')[0];
          if (clickToExpand.offsetHeight) {
              clickToExpand.click();
          }
      };

      anchor.addEventListener('click', clickHandler);

      element.appendChild(icon);
      element.appendChild(anchor);
      return element;
  }

  function makeTree(node, rootElement) {
      if (node.leaf) {
          const leaf = createLeafElement(node);
          rootElement.appendChild(leaf);
          return;
      }

      const [folder, list] = createFolderElement(node);
      rootElement.appendChild(folder);

      const sortChildren = (a, b) => {
          const nodeA = node.children[a];
          const nodeB = node.children[b];

          // folders first
          if (!nodeA.leaf && nodeB.leaf) {
              return -1;
          }
          if (nodeA.leaf && !nodeB.leaf) {
              return 1;
          }

          const aPath = nodeA.path.toLowerCase();
          const bPath = nodeB.path.toLowerCase();
          // alphabetical by path name
          if (aPath < bPath) {
              return -1;
          } else if (aPath > bPath) {
              return 1;
          }
          return 0;
      };

      Object.keys(node.children).sort(sortChildren).forEach(childKey => makeTree(node.children[childKey], list));
  }

  function createHeading(fileCount) {
      const iconWrapper = createElement('div');
      iconWrapper.classList.add('nav-icon-container');

      const icon = createElement('i');
      icon.classList.add('fa', 'fa-list-ul');
      iconWrapper.appendChild(icon);

      const name = createElement('span');
      name.textContent = 'File List';
      name.classList.add('nav-item-name');

      const badge = createElement('span');
      badge.classList.add('badge', 'count');
      badge.textContent = fileCount;

      const heading = createElement('a');
      heading.classList.add('gl-file-tree__heading');
      heading.appendChild(iconWrapper);
      heading.appendChild(name);
      heading.appendChild(badge);

      return heading;
  }

  function createTreeView() {
      const fileInfo = getFileInfo();
      const tree = buildTree(fileInfo);

      const div = createElement('li');
      div.classList.add('gl-file-tree');

      div.appendChild(createHeading(fileInfo.length));

      const treeView = createElement('div');
      treeView.classList.add('gl-file-tree__tree-view');

      div.appendChild(treeView);

      const rootElement = createElement('ul');
      makeTree(tree, rootElement);

      treeView.appendChild(rootElement);

      const mergeRequestSidebarElement = unsafeWindow.document.getElementsByClassName('shortcuts-merge_requests')[0].parentElement;
      mergeRequestSidebarElement.insertAdjacentElement('afterend', div);
  }

  function checkIfDiffReady() {
      const diffNode = unsafeWindow.document.getElementById('diffs');
      const active = diffNode && diffNode.classList.contains('active');
      const hasChildren = diffNode && !!diffNode.childElementCount;

      if (!active || !hasChildren) {
          unsafeWindow.setTimeout(checkIfDiffReady, 1000);
          return;
      }

      createTreeView();
  }

  checkIfDiffReady();
})();