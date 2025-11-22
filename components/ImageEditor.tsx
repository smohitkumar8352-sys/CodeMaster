
import React, { useState, useRef } from 'react';
import { Upload, Image as ImageIcon, Wand2, Download, Loader2 } from 'lucide-react';
import { editImage } from '../services/gemini';

const ImageEditor: React.FC = () => {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setOriginalImage(event.target.result as string);
          setProcessedImage(null);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!originalImage || !prompt) return;
    setIsProcessing(true);

    try {
      // Extract base64 data
      const mimeType = originalImage.split(';')[0].split(':')[1];
      const base64Data = originalImage.split(',')[1];
      const resultBase64 = await editImage(base64Data, prompt, mimeType);
      
      if (resultBase64) {
        setProcessedImage(`data:image/png;base64,${resultBase64}`);
      } else {
        alert("No image generated. Please try a different prompt.");
      }
    } catch (error) {
      console.error(error);
      alert("Failed to process image.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 shadow-lg flex flex-col items-center text-center space-y-4">
        <div className="p-3 bg-emerald-500/10 rounded-full">
            <ImageIcon className="w-8 h-8 text-emerald-500" />
        </div>
        <h2 className="text-2xl font-bold text-white">AI Image Editor</h2>
        <p className="text-gray-400 max-w-xl">
            Upload an image and use natural language to edit it. 
            Try "Add a retro filter", "Make it look like a sketch", or "Remove the background".
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Input Section */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-6">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Upload className="w-5 h-5 text-emerald-500" /> Source Image
            </h3>
            
            <div 
                className="aspect-square rounded-lg border-2 border-dashed border-gray-700 flex flex-col items-center justify-center bg-gray-950/50 hover:bg-gray-950/80 transition-colors cursor-pointer overflow-hidden relative group"
                onClick={() => !originalImage && fileInputRef.current?.click()}
            >
                {originalImage ? (
                    <>
                        <img src={originalImage} alt="Original" className="w-full h-full object-contain" />
                        <button 
                            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                            className="absolute inset-