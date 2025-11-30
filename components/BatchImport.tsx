import React, { useState } from 'react';
import { X, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { CozeVoice } from '../types';

interface BatchImportProps {
  isOpen: boolean;
  onClose: () => void;
  voices: CozeVoice[];
  onImport: (items: BatchImportItem[]) => void;
  token: string;
}

export interface BatchImportItem {
  text: string;
  voiceId: string;
  voiceName: string;
  breakTime?: number; // 与下一个片段的间隔时间（秒）
}

const BatchImport: React.FC<BatchImportProps> = ({ isOpen, onClose, voices, onImport, token }) => {
  const [text, setText] = useState('');
  const [isShowHelp, setIsShowHelp] = useState(false);

  const parseBatchText = (input: string): BatchImportItem[] => {
    const items: BatchImportItem[] = [];

    if (!input.trim()) return items;

    // 按换行符分割
    const lines = input.split(/\r?\n/);
    let currentVoice: CozeVoice | null = null;
    let currentText = '';
    let pendingBreakTime: number | undefined = undefined;

    const flushCurrentItem = (breakTime?: number) => {
      if (currentText.trim() && currentVoice) {
        // 保存当前项，使用传入的 breakTime 或之前设置的 pendingBreakTime
        items.push({
          text: currentText.trim(),
          voiceId: currentVoice.voice_id,
          voiceName: currentVoice.name,
          breakTime: breakTime !== undefined ? breakTime : pendingBreakTime,
        });
        currentText = '';
        pendingBreakTime = undefined; // 清除待处理的间隔时间
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // 检查是否是间隔标记 <break time="1s"/>
      const breakMatch = line.match(/<break\s+time="?(\d+(?:\.\d+)?)s?"?\s*\/?>/i);
      if (breakMatch) {
        // 如果当前有语音内容，先保存它并应用间隔时间
        if (currentText.trim() && currentVoice) {
          flushCurrentItem(parseFloat(breakMatch[1]));
        } else {
          // 如果当前没有语音内容，说明间隔标记在空行之后，应用到上一个已保存的项
          if (items.length > 0) {
            items[items.length - 1].breakTime = parseFloat(breakMatch[1]);
          }
        }
        continue;
      }

      // 空行表示一个语音结束
      if (!line) {
        // 如果之前有待处理的间隔时间，先应用它
        flushCurrentItem();
        continue;
      }

      // 检查是否是音色标记 【音色名】文本内容
      const voiceMatch = line.match(/^【(.+?)】\s*(.*)$/);
      if (voiceMatch) {
        // 保存之前的文本（如果有）
        flushCurrentItem();

        const voiceName = voiceMatch[1].trim();
        const textContent = voiceMatch[2].trim();

        // 查找匹配的音色（支持部分匹配）
        const matchedVoice = voices.find(v =>
          v.name === voiceName ||
          v.name.includes(voiceName) ||
          voiceName.includes(v.name)
        );

        if (matchedVoice) {
          currentVoice = matchedVoice;
          currentText = textContent;
        } else {
          currentVoice = null;
          currentText = '';
        }
        continue;
      }

      // 普通文本行
      if (currentVoice) {
        if (currentText) {
          currentText += ' ' + line;
        } else {
          currentText = line;
        }
      }
    }

    // 处理最后一个片段
    flushCurrentItem();

    return items;
  };

  const handleImport = () => {
    if (!token) {
      alert('请先输入身份令牌 (Token)');
      return;
    }

    const items = parseBatchText(text);

    if (items.length === 0) {
      alert('没有解析到有效的语音内容，请检查格式');
      return;
    }

    // 验证所有音色是否都找到了
    const invalidItems = items.filter(item => !item.voiceId);
    if (invalidItems.length > 0) {
      const invalidNames = [...new Set(invalidItems.map(item => {
        // 尝试从文本中提取音色名
        const match = text.match(/【(.+?)】/);
        return match ? match[1] : '未知';
      }))];
      alert(`以下音色未找到：${invalidNames.join(', ')}\n请检查音色名称是否正确`);
      return;
    }

    onImport(items);
    setText('');
    onClose();
  };

  const handlePreview = () => {
    const items = parseBatchText(text);
    console.log('解析结果:', items);
    alert(`解析到 ${items.length} 个语音片段\n\n${items.map((item, idx) =>
      `${idx + 1}. 【${item.voiceName || '未找到音色'}】${item.text.substring(0, 30)}${item.text.length > 30 ? '...' : ''}${item.breakTime ? ` (间隔: ${item.breakTime}s)` : ''}`
    ).join('\n')}`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <FileText className="text-indigo-600" size={24} />
            <h2 className="text-xl font-bold text-gray-900">批量导入</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Help Button */}
          <div className="flex justify-end">
            <button
              onClick={() => setIsShowHelp(!isShowHelp)}
              className="text-sm text-indigo-600 hover:text-indigo-700 underline"
            >
              {isShowHelp ? '隐藏' : '显示'}使用说明
            </button>
          </div>

          {/* Help Content */}
          {isShowHelp && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-blue-900 flex items-center gap-2">
                <AlertCircle size={18} />
                使用说明
              </h3>
              <div className="text-sm text-blue-800 space-y-2">
                <p><strong>1. 指定音色：</strong>使用【音色名称】来指定生成的语音音色</p>
                <p><strong>2. 分隔语音：</strong>空格或换行代表一个语音结束</p>
                <p><strong>3. 设置间隔：</strong>&lt;break time="1s"/&gt; 代表上一个语音和下一个语音间隔多久（秒）</p>
                <div className="mt-3 bg-white p-3 rounded border border-blue-200">
                  <p className="font-mono text-xs text-gray-700 whitespace-pre-wrap">
                    {`示例：
【湾区大叔】你好，欢迎使用语音工作室
【少年梓辛】这是一个批量导入功能
<break time="1.5s"/>
【湾区大叔】可以通过换行或空格分隔不同的语音
【少年梓辛】还可以设置语音之间的间隔时间`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Text Input */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              批量文本内容
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`示例：\n【湾区大叔】你好，欢迎使用语音工作室\n【少年梓辛】这是一个批量导入功能\n<break time="1.5s"/>\n【湾区大叔】可以通过换行或空格分隔不同的语音`}
              className="w-full h-64 p-4 border border-gray-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 resize-none font-mono text-sm"
            />
            <div className="flex justify-between items-center text-xs text-gray-500">
              <span>{text.split('\n').length} 行</span>
              <span>{text.length} 字符</span>
            </div>
          </div>

          {/* Preview Button */}
          <div className="flex justify-end">
            <button
              onClick={handlePreview}
              className="px-4 py-2 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg border border-indigo-200 transition-colors"
            >
              预览解析结果
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleImport}
            disabled={!text.trim() || !token}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors flex items-center gap-2 ${!text.trim() || !token
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
          >
            <CheckCircle2 size={16} />
            开始导入
          </button>
        </div>
      </div>
    </div>
  );
};

export default BatchImport;

