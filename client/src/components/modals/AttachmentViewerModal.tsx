import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ExternalLink, Download } from 'lucide-react';

interface AttachmentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  attachmentPath: string;
  title?: string;
}

export function AttachmentViewerModal({ isOpen, onClose, attachmentPath, title = 'Visualizar Anexo' }: AttachmentViewerModalProps) {
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  
  const isPDF = attachmentPath.toLowerCase().endsWith('.pdf');
  const fileName = attachmentPath.split('/').pop() || 'arquivo';
  
  const handleLoad = () => {
    setIsLoading(false);
  };
  
  const handleError = () => {
    setIsLoading(false);
    setError('Não foi possível carregar o anexo. Tente abrir em uma nova aba.');
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        
        <div className="min-h-[300px] flex items-center justify-center overflow-auto">
          {isLoading && (
            <div className="flex flex-col items-center justify-center text-muted-foreground">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mb-2" />
              <div>Carregando anexo...</div>
            </div>
          )}
          
          {error && (
            <div className="text-center text-destructive">
              <p>{error}</p>
            </div>
          )}
          
          {isPDF ? (
            <object
              data={attachmentPath}
              type="application/pdf"
              width="100%"
              height="500px"
              onLoad={handleLoad}
              onError={handleError}
              className={isLoading ? 'hidden' : ''}
            >
              <p>Seu navegador não suporta a visualização de PDFs. <a href={attachmentPath} target="_blank" rel="noopener noreferrer">Clique aqui para baixar</a></p>
            </object>
          ) : (
            <img
              src={attachmentPath}
              alt="Anexo"
              className={`max-w-full max-h-[70vh] object-contain ${isLoading ? 'hidden' : ''}`}
              onLoad={handleLoad}
              onError={handleError}
            />
          )}
        </div>
        
        <DialogFooter className="flex justify-between">
          <div>
            <Button variant="secondary" onClick={onClose}>Fechar</Button>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => window.open(attachmentPath, '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Abrir em nova aba
            </Button>
            <Button 
              variant="default"
              onClick={() => {
                const link = document.createElement('a');
                link.href = attachmentPath;
                link.download = fileName;
                link.click();
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Baixar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
