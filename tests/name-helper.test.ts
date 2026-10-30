import { describe, it, expect } from 'vitest';
import { parseFullName } from '@/lib/name-helper';

describe('name-helper: parseFullName', () => {
    it('handles empty input', () => {
        expect(parseFullName('')).toEqual({ firstName: '', middleName: '', lastName: '' });
        expect(parseFullName('   ')).toEqual({ firstName: '', middleName: '', lastName: '' });
    });

    it('handles single word name', () => {
        expect(parseFullName('สมชาย')).toEqual({ firstName: 'สมชาย', middleName: '', lastName: '' });
        expect(parseFullName('Ronaldo')).toEqual({ firstName: 'Ronaldo', middleName: '', lastName: '' });
    });

    it('handles two-word full name', () => {
        expect(parseFullName('สมชาย ใจดี')).toEqual({ firstName: 'สมชาย', middleName: '', lastName: 'ใจดี' });
        expect(parseFullName('John Doe')).toEqual({ firstName: 'John', middleName: '', lastName: 'Doe' });
    });

    it('handles Thai honorific title prefixes', () => {
        expect(parseFullName('นาย สมชาย ใจดี')).toEqual({ firstName: 'นาย สมชาย', middleName: '', lastName: 'ใจดี' });
        expect(parseFullName('ด.ช. สมศักดิ์ รักดี')).toEqual({ firstName: 'ด.ช. สมศักดิ์', middleName: '', lastName: 'รักดี' });
        expect(parseFullName('นางสาว กัญญา สมบูรณ์')).toEqual({ firstName: 'นางสาว กัญญา', middleName: '', lastName: 'สมบูรณ์' });
    });

    it('handles English titles and middle names', () => {
        expect(parseFullName('Mr. John Doe')).toEqual({ firstName: 'Mr. John', middleName: '', lastName: 'Doe' });
        expect(parseFullName('Lionel Andrés Messi')).toEqual({ firstName: 'Lionel', middleName: 'Andrés', lastName: 'Messi' });
        expect(parseFullName('Alex Van Der Sar')).toEqual({ firstName: 'Alex', middleName: '', lastName: 'Van Der Sar' });
    });

    it('handles multiple whitespace properly', () => {
        expect(parseFullName('   สมชาย     ใจดี   ')).toEqual({ firstName: 'สมชาย', middleName: '', lastName: 'ใจดี' });
    });
});
