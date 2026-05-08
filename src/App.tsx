import { Badge, Card, Text, Title1, makeStyles, tokens } from '@fluentui/react-components';
import { prototypeManifest } from './prototypeManifest';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    gap: tokens.spacingVerticalL,
    padding: tokens.spacingHorizontalXXL,
  },
  hero: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  cards: {
    display: 'grid',
    gap: tokens.spacingHorizontalM,
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
  commands: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
});

export function App() {
  const styles = useStyles();
  const isPrototypeMode = import.meta.env.VITE_USE_MOCK === 'true';

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <Badge appearance="filled" color={isPrototypeMode ? 'success' : 'informative'}>
          {isPrototypeMode ? 'Prototype Mode' : 'Connected Mode'}
        </Badge>
        <Title1 as="h1">Solution Streamliner</Title1>
        <Text>
          Start with mock-backed UX, capture what the prototype changes in the data model,
          then add real providers and connectors once the planning payload is stable.
        </Text>
      </div>

      <div className={styles.cards}>
        {prototypeManifest.entities.map((entity) => (
          <Card key={entity.collectionName} className={styles.card}>
            <Title1 as="h2">{entity.displayName}</Title1>
            <Text>{entity.description}</Text>
            <Text>Provider contract: {entity.repositoryName}</Text>
            <Text>Mock data: {entity.mockDataFile}</Text>
          </Card>
        ))}
      </div>

      <Card className={styles.commands}>
        <Text>Commands</Text>
        <Text>1. npm run dev:local</Text>
        <Text>2. Edit dataverse/planning-payload.json</Text>
        <Text>3. npm run prototype:seed</Text>
        <Text>4. Review dataverse/prototype-feedback.md</Text>
        <Text>5. npm run dev once real providers exist</Text>
      </Card>
    </div>
  );
}
