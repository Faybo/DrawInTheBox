# The Million Dollar Painting

Uma obra de arte colaborativa inspirada no "The Million Dollar Homepage", onde usuários podem comprar e personalizar quadrados em uma tela virtual.

## Visão Geral

The Million Dollar Painting é uma aplicação web que permite aos usuários:

- Comprar quadrados individuais na tela virtual 
- Personalizar quadrados comprados com desenhos ou imagens
- Ver e comprar quadrados de outros usuários, mantendo o desenho original
- Ver a obra completa em tempo real
- Interagir com outros artistas na comunidade

## Sistema de Propriedade dos Quadrados

**Importante**: Este projeto utiliza um sistema de propriedade com potencial para monetização:

- Quando você compra um quadrado, obtém direitos exclusivos para desenhar nele
- Se outro usuário comprar um quadrado que você possui, você perde os direitos sobre ele
- O desenho é preservado quando um quadrado muda de proprietário
- Os pagamentos são processados através do Stripe e serão reais na versão de produção
- Na versão de desenvolvimento, utilizamos o ambiente de teste do Stripe

O objetivo deste projeto é criar uma experiência artística colaborativa que também gera renda através da venda de quadrados.

## Integração com Stripe

A aplicação utiliza o Stripe para processar pagamentos reais. Durante o desenvolvimento, estamos usando o ambiente de teste do Stripe.

### Ambiente de Teste (Desenvolvimento)

Para testar a aplicação, você pode usar os seguintes cartões:

- **Cartão de teste com sucesso**: 4242 4242 4242 4242
- **Data de validade**: Qualquer data futura no formato MM/AA
- **CVC**: Qualquer 3 dígitos
- **Nome no cartão**: Qualquer nome

Nenhum pagamento real será processado no ambiente de teste.

### Ambiente de Produção

Na versão de produção, os pagamentos serão processados de forma segura pelo Stripe, com as seguintes características:

- Processamento seguro de cartões de crédito e débito
- Suporte a diversos métodos de pagamento (PayPal, Google Pay, Apple Pay)
- Conformidade com PCI DSS para segurança dos dados
- Experiência de checkout otimizada e responsiva

## Tecnologias Utilizadas

- React + TypeScript
- Firebase (Firestore, Authentication, Storage)
- Tailwind CSS
- Canvas API
- Stripe (processamento de pagamentos)

## Funcionalidades Principais

### Autenticação
- Login simplificado via Google
- Perfil de usuário mostra quadrados de sua propriedade

### Grid de Quadrados
- Grid responsiva que se adapta a todos os tamanhos de tela
- Navegação intuitiva com zoom e panning
- Visual claro com indicadores para quadrados do usuário

### Visualização e Compra
- Clique em qualquer quadrado para visualizá-lo em tamanho maior
- Visualize detalhes do quadrado, incluindo preço e proprietário
- Opção para comprar o quadrado, mantendo o desenho original

### Desenho e Personalização
- Editor de desenho com múltiplas cores e tamanhos de pincel
- Opção para desfazer e limpar o desenho
- Salvamento automático das alterações

### Visualização da Obra Completa
- Modo de visualização otimizado para mostrar todos os quadrados
- Zoom para examinar detalhes específicos
- Opção para download da obra completa

## Instruções de Uso

1. **Login**: Faça login usando sua conta Google
2. **Navegação**: Use o mouse/touchpad para navegar pela grid
3. **Visualização**: Clique em qualquer quadrado para visualizá-lo em detalhes
4. **Compra**: Compre quadrados disponíveis ou de outros usuários
5. **Desenho**: Após comprar, clique no quadrado para abrir o editor de desenho
6. **Visualização Completa**: Use o botão "Ver Obra Completa" para visualizar toda a tela

## Configurações do Grid

**IMPORTANTE: Não alterar estas configurações sem necessidade!**

- Tamanho do grid: 120x120 quadrados
- Tamanho mínimo de cada quadrado: 14px
- Tamanho máximo de cada quadrado: 24px
- Posicionamento atual: Alinhado mais à direita para melhor visualização
- Layout responsivo que se adapta ao tamanho da tela

Estas configurações foram cuidadosamente ajustadas para proporcionar a melhor experiência visual sem necessidade de scroll excessivo.

## Melhorias Recentes

- Correção de problemas de carregamento ao visualizar a obra completa
- Otimização de performance para dispositivos móveis e desktop
- Interface traduzida para português
- Melhorias visuais para identificação de quadrados comprados
- Processo de autenticação simplificado
- Ajuste do tamanho dos quadrados para melhor visualização
- Otimização do formulário de pagamento com cartão
- Adição da opção de pagamento Stripe Link
- Visualização ampliada de quadrados de outros usuários
- Preservação do desenho quando um quadrado é comprado de outro usuário
- Reposicionamento do grid para ocupar mais espaço na tela
- Clarificação do sistema de compra/venda sem recompensas financeiras

## Como Executar Localmente

```bash
# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento
npm run dev

# Construir para produção
npm run build
```

## Notas Importantes

- Este projeto é puramente demonstrativo
- Nenhum pagamento real é processado
- Os dados persistem no Firebase, permitindo colaboração entre usuários

## Limitações Conhecidas

- O editor de desenho tem funcionalidades básicas
- Quadrados muito pequenos podem ser difíceis de editar em dispositivos móveis
- A visualização completa pode ser lenta em dispositivos com pouca memória

---

Desenvolvido como projeto de demonstração. Todos os direitos reservados. 