declare class Package {
    static version: any;
    sum: (a: number, b: number) => Promise<number>;
}
export default Package;
