export default function sortByDesc(a: any, b: any) {
    const nameA = a.id; // ignore upper and lowercase
    const nameB = b.id; // ignore upper and lowercase
    if (nameA > nameB) {
        return -1;
    }
    if (nameA < nameB) {
        return 1;
    }

    // names must be equal
    return 0;
}