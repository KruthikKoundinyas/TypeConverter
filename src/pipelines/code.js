import { escapeHtml, getFileExtension, getMimeType, readFileAsText } from '../utils.js';

function jsonToXml(obj, rootName = 'root') {
  function serialize(value, tag) {
    if (value === null || value === undefined) return `<${tag}/>`;
    if (Array.isArray(value)) {
      return value.map((item) => serialize(item, 'item')).join('\n');
    }
    if (typeof value === 'object') {
      const children = Object.entries(value)
        .map(([k, v]) => serialize(v, k))
        .join('\n');
      return `<${tag}>\n${children}\n</${tag}>`;
    }
    const escaped = String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return `<${tag}>${escaped}</${tag}>`;
  }
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + serialize(obj, rootName);
}

function xmlToJson(xmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'application/xml');
  const errorNode = doc.querySelector('parsererror');
  if (errorNode) throw new Error('Invalid XML');

  function walk(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent.trim();
      return text || null;
    }
    const children = Array.from(node.childNodes).filter(
      (n) => n.nodeType === Node.ELEMENT_NODE || (n.nodeType === Node.TEXT_NODE && n.textContent.trim()),
    );
    if (children.length === 1 && children[0].nodeType === Node.TEXT_NODE) {
      return children[0].textContent.trim();
    }
    const result = {};
    for (const child of children) {
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const key = child.tagName;
      const value = walk(child);
      if (result[key] !== undefined) {
        if (!Array.isArray(result[key])) result[key] = [result[key]];
        result[key].push(value);
      } else {
        result[key] = value;
      }
    }
    return Object.keys(result).length ? result : node.textContent.trim() || '';
  }
  return walk(doc.documentElement);
}

export async function convertCodeText(file, targetFormat) {
  const text = await readFileAsText(file);
  const srcExt = getFileExtension(file.name);
  let output;

  if (targetFormat === 'html') {
    if (srcExt === 'md' || srcExt === 'markdown') {
      output = marked.parse(text);
    } else if (srcExt === 'json') {
      output = '<pre>' + escapeHtml(JSON.stringify(JSON.parse(text), null, 2)) + '</pre>';
    } else if (srcExt === 'yaml' || srcExt === 'yml') {
      const data = jsyaml.load(text);
      output = '<pre>' + escapeHtml(JSON.stringify(data, null, 2)) + '</pre>';
    } else if (srcExt === 'xml') {
      output = '<pre>' + escapeHtml(text) + '</pre>';
    } else {
      output = '<pre>' + escapeHtml(text) + '</pre>';
    }
  } else if (targetFormat === 'md') {
    if (srcExt === 'html' || srcExt === 'htm') {
      const td = new TurndownService();
      output = td.turndown(text);
    } else if (srcExt === 'json') {
      output = '```json\n' + JSON.stringify(JSON.parse(text), null, 2) + '\n```';
    } else if (srcExt === 'yaml' || srcExt === 'yml') {
      output = '```yaml\n' + text + '\n```';
    } else if (srcExt === 'xml') {
      output = '```xml\n' + text + '\n```';
    } else {
      output = text;
    }
  } else if (targetFormat === 'json') {
    if (srcExt === 'yaml' || srcExt === 'yml') {
      const data = jsyaml.load(text);
      output = JSON.stringify(data, null, 2);
    } else if (srcExt === 'xml') {
      const data = xmlToJson(text);
      output = JSON.stringify(data, null, 2);
    } else if (srcExt === 'json') {
      output = JSON.stringify(JSON.parse(text), null, 2);
    } else {
      output = JSON.stringify({ content: text });
    }
  } else if (targetFormat === 'yaml') {
    if (srcExt === 'json') {
      const data = JSON.parse(text);
      output = jsyaml.dump(data, { indent: 2 });
    } else if (srcExt === 'xml') {
      const data = xmlToJson(text);
      output = jsyaml.dump(data, { indent: 2 });
    } else if (srcExt === 'yaml' || srcExt === 'yml') {
      const data = jsyaml.load(text);
      output = jsyaml.dump(data, { indent: 2 });
    } else {
      output = jsyaml.dump({ content: text }, { indent: 2 });
    }
  } else if (targetFormat === 'xml') {
    if (srcExt === 'json') {
      const data = JSON.parse(text);
      output = jsonToXml(data);
    } else if (srcExt === 'yaml' || srcExt === 'yml') {
      const data = jsyaml.load(text);
      output = jsonToXml(data);
    } else if (srcExt === 'xml') {
      output = text;
    } else {
      output = jsonToXml({ content: text });
    }
  } else if (targetFormat === 'txt') {
    if (srcExt === 'html' || srcExt === 'htm') {
      const tmp = document.createElement('div');
      tmp.innerHTML = text;
      output = tmp.textContent || tmp.innerText || '';
    } else if (srcExt === 'json') {
      output = JSON.stringify(JSON.parse(text), null, 2);
    } else {
      output = text;
    }
  } else {
    output = text;
  }

  const blob = new Blob([output], { type: getMimeType(targetFormat) });
  return { blob, originalSize: file.size, convertedSize: blob.size };
}
