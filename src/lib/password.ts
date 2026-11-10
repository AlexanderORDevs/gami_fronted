export function generateSuggestedPassword() {
  const groups = [
    "ABCDEFGHJKLMNPQRSTUVWXYZ",
    "abcdefghijkmnopqrstuvwxyz",
    "23456789",
    "!@#$%&*?",
  ];
  const characters = groups.join("");
  const randomIndex = (length: number) => {
    const value = new Uint32Array(1);
    crypto.getRandomValues(value);
    return value[0] % length;
  };
  const password = groups.map((group) => group[randomIndex(group.length)]);
  while (password.length < 16)
    password.push(characters[randomIndex(characters.length)]);
  for (let index = password.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(index + 1);
    [password[index], password[swapIndex]] = [
      password[swapIndex],
      password[index],
    ];
  }
  return password.join("");
}
