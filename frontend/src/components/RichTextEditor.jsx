import { useRef, useEffect } from 'react';
import DOMPurify from 'dompurify';

export default function RichTextEditor({ content, onChange, placeholder = 'Write your answer here...', editable = true }) {
  const ref = useRef(null);

  useEffect(() => {
    const safeContent = DOMPurify.sanitize(content || '');
    if (ref.current && ref.current.innerHTML !== safeContent) {
      ref.current.innerHTML = safeContent;
    }
  }, [content]);

  const handleInput = () => {
    if (onChange && ref.current) onChange(ref.current.innerHTML);
  };

  const exec = (cmd, val = null) => {
    if (cmd === 'createLink' && val && !/^https?:\/\//i.test(val)) return;
    document.execCommand(cmd, false, val);
    ref.current?.focus();
    handleInput();
  };

  if (!editable) {
    return <div className="min-h-[200px] p-3 border border-gray-200 rounded-lg bg-gray-50 text-sm" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content || '') }} />;
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex flex-wrap gap-1 p-2 bg-gray-50 border-b border-gray-200">
        {[
          ['bold', 'B'], ['italic', 'I'], ['underline', 'U'],
          ['insertUnorderedList', '•'], ['insertOrderedList', '1.'],
          ['justifyLeft', '≡'], ['justifyCenter', '≡'], ['justifyRight', '≡'],
        ].map(([cmd, label]) => (
          <button key={cmd} type="button" onMouseDown={e => { e.preventDefault(); exec(cmd); }} className="px-2 py-1 text-xs font-medium bg-white border border-gray-200 rounded hover:bg-gray-100">
            {label}
          </button>
        ))}
        <button type="button" onMouseDown={e => { e.preventDefault(); const url = prompt('Enter URL:'); if (url) exec('createLink', url); }} className="px-2 py-1 text-xs bg-white border rounded hover:bg-gray-100">Link</button>
      </div>
      <div
        ref={ref}
        contentEditable
        onInput={handleInput}
        onBlur={handleInput}
        data-placeholder={placeholder}
        className="min-h-[280px] p-3 text-sm leading-6 focus:outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400"
        suppressContentEditableWarning
      />
    </div>
  );
}
